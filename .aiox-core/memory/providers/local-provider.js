'use strict';

const fs = require('fs');
const path = require('path');
const { MemoryProvider, MEMORY_TYPES } = require('./provider-interface');
const { FrontmatterSerializer } = require('../serializers/frontmatter');

/**
 * LocalProvider — Filesystem-based memory provider.
 *
 * Wraps the existing AIOS filesystem layout behind the MemoryProvider interface.
 * When provider is "local", everything works identically to before.
 *
 * Maps memory types to filesystem directories.
 * Agents read from .aiox-core/development/agents.
 * Other types (session, decision, handoff, etc.) use .aiox-core/memory/data.
 */
class LocalProvider extends MemoryProvider {
  constructor() {
    super('local');
    this.basePath = null;
    this.serializer = new FrontmatterSerializer();
    this._pathCache = new Map();
  }

  async initialize(config = {}) {
    this.basePath = path.resolve(config.base_path || './');
    this._ensureDirectories();
  }

  // ─── PATH RESOLUTION ─────────────────────────────────

  /**
   * Map a memory type to its filesystem directory.
   * @param {string} type
   * @returns {string} Absolute path to the directory
   * @private
   */
  _dirFor(type) {
    const dirs = {
      agent: path.join(this.basePath, '.aiox-core', 'development', 'agents'),
      squad: path.join(this.basePath, 'squads'),
      session: path.join(this.basePath, '.aiox-core', 'memory', 'data', 'sessions'),
      decision: path.join(this.basePath, '.aiox-core', 'memory', 'data', 'decisions'),
      handoff: path.join(this.basePath, '.aiox-core', 'memory', 'data', 'handoffs'),
      component: path.join(this.basePath, '.aiox-core', 'memory', 'data', 'components'),
      project: path.join(this.basePath, '.aiox-core', 'memory', 'data', 'projects'),
      pipeline: path.join(this.basePath, '.aiox-core', 'memory', 'data', 'pipelines'),
    };
    return dirs[type] || path.join(this.basePath, '.aiox-core', 'memory', 'data', type);
  }

  /**
   * Resolve an item ID to its file path.
   * @param {string} id
   * @param {string} [type] - If known, speeds up resolution
   * @returns {string|null} Absolute file path or null
   * @private
   */
  _pathFor(id, type) {
    // Check cache first
    if (this._pathCache.has(id)) {
      return this._pathCache.get(id);
    }

    // If type is known, look in the specific directory
    if (type) {
      const dir = this._dirFor(type);
      const filePath = this._findFileInDir(dir, id);
      if (filePath) {
        this._pathCache.set(id, filePath);
        return filePath;
      }
    }

    // Brute-force: search all type directories
    for (const t of MEMORY_TYPES) {
      const dir = this._dirFor(t);
      const filePath = this._findFileInDir(dir, id);
      if (filePath) {
        this._pathCache.set(id, filePath);
        return filePath;
      }
    }

    return null;
  }

  /**
   * Find a file matching an ID in a directory.
   * Tries: id.md, id/index.md, and filename containing the id slug.
   * @private
   */
  _findFileInDir(dir, id) {
    if (!fs.existsSync(dir)) return null;

    // Direct match: {id}.md
    const direct = path.join(dir, `${id}.md`);
    if (fs.existsSync(direct)) return direct;

    // Slug match: strip type prefix (e.g., "agent-copywriter" -> "copywriter")
    const slug = id.replace(/^(agent|squad|sess|dec|ho|comp|project|pipeline)-/, '');
    const slugPath = path.join(dir, `${slug}.md`);
    if (fs.existsSync(slugPath)) return slugPath;

    // Search within directory for files containing the id in frontmatter
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(dir, entry.name);
          const content = fs.readFileSync(filePath, 'utf8');
          const { frontmatter } = this.serializer.parse(content);
          if (frontmatter.id === id || frontmatter.agent?.id === id) {
            this._pathCache.set(id, filePath);
            return filePath;
          }
        }
      }
    } catch {
      // Directory might not exist or be readable
    }

    return null;
  }

  /**
   * Ensure data directories exist for writable types.
   * @private
   */
  _ensureDirectories() {
    const writableTypes = ['session', 'decision', 'handoff', 'component', 'project', 'pipeline'];
    for (const type of writableTypes) {
      const dir = this._dirFor(type);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  // ─── READ ───────────────────────────────────────────

  async list(type, filters = {}) {
    const dir = this._dirFor(type);
    if (!fs.existsSync(dir)) return [];

    const results = [];
    const files = this._listMdFiles(dir);

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const { frontmatter } = this.serializer.parse(content);

        // Normalize: agent files have nested structure
        const normalized = this._normalizeFrontmatter(frontmatter, type, filePath);
        if (!normalized.type && !normalized.id) continue;

        // Apply filters
        if (filters.status && normalized.status !== filters.status) continue;
        if (filters.project && normalized.project !== filters.project) continue;
        if (filters.since && normalized.updated < filters.since) continue;

        results.push(this.serializer.toL0(normalized));
      } catch {
        // Skip unparseable files
      }
    }

    // Apply limit
    const limit = filters.limit || 50;
    return results.slice(0, limit);
  }

  async getContext(id) {
    const filePath = this._pathFor(id);
    if (!filePath) {
      throw new Error(`[LocalProvider] Item not found: ${id}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const { frontmatter } = this.serializer.parse(content);
    return this._normalizeFrontmatter(frontmatter, null, filePath);
  }

  async getFull(id) {
    const filePath = this._pathFor(id);
    if (!filePath) {
      throw new Error(`[LocalProvider] Item not found: ${id}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = this.serializer.parse(content);
    parsed.frontmatter = this._normalizeFrontmatter(parsed.frontmatter, null, filePath);
    return parsed;
  }

  async search(query, scope = {}) {
    const queryLower = query.toLowerCase();
    const results = [];
    const typesToSearch = scope.type ? [scope.type] : MEMORY_TYPES;

    for (const type of typesToSearch) {
      const dir = this._dirFor(type);
      if (!fs.existsSync(dir)) continue;

      const files = this._listMdFiles(dir);
      for (const filePath of files) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const contentLower = content.toLowerCase();

          if (contentLower.includes(queryLower)) {
            const { frontmatter } = this.serializer.parse(content);
            const normalized = this._normalizeFrontmatter(frontmatter, type, filePath);

            // Simple relevance: count occurrences
            const occurrences = contentLower.split(queryLower).length - 1;

            results.push({
              id: normalized.id || path.basename(filePath, '.md'),
              type: normalized.type || type,
              summary: normalized.summary || '',
              relevance: occurrences,
            });
          }
        } catch {
          // Skip
        }
      }
    }

    // Sort by relevance descending
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, scope.limit || 10);
  }

  async recent(type, opts = {}) {
    const dir = this._dirFor(type);
    if (!fs.existsSync(dir)) return [];

    const files = this._listMdFiles(dir);
    const items = [];

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const { frontmatter } = this.serializer.parse(content);
        const normalized = this._normalizeFrontmatter(frontmatter, type, filePath);

        // Use updated/date field or file mtime for sorting
        const sortDate = normalized.updated || normalized.date || normalized.last_run;
        const mtime = fs.statSync(filePath).mtime.toISOString();

        items.push({
          ...normalized,
          _sortKey: sortDate || mtime,
        });
      } catch {
        // Skip
      }
    }

    // Sort by date descending
    items.sort((a, b) => (b._sortKey || '').localeCompare(a._sortKey || ''));

    const limit = opts.limit || 5;
    return items.slice(0, limit).map(item => {
      const { _sortKey, ...rest } = item;
      return rest;
    });
  }

  // ─── WRITE ──────────────────────────────────────────

  async write(id, data, opts = {}) {
    const type = data.type;
    if (!type) {
      throw new Error(`[LocalProvider] write() requires data.type`);
    }

    const dir = this._dirFor(type);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Build filename from id
    const slug = id.replace(/^(agent|squad|sess|dec|ho|comp|project|pipeline)-/, '');
    const fileName = `${slug}.md`;
    const filePath = path.join(dir, fileName);

    const frontmatter = {
      ...data.frontmatter,
      id,
      type,
      updated: new Date().toISOString(),
    };

    if (opts.merge && fs.existsSync(filePath)) {
      // Merge with existing frontmatter
      const existing = this.serializer.parse(fs.readFileSync(filePath, 'utf8'));
      const merged = { ...existing.frontmatter, ...frontmatter };
      const body = data.body !== undefined ? data.body : existing.body;
      const content = this.serializer.serialize(merged, body);
      fs.writeFileSync(filePath, content, 'utf8');
    } else {
      const content = this.serializer.serialize(frontmatter, data.body || '');
      fs.writeFileSync(filePath, content, 'utf8');
    }

    // Update cache
    this._pathCache.set(id, filePath);

    return { id, path: filePath, written: true };
  }

  async patch(id, fields) {
    const filePath = this._pathFor(id);
    if (!filePath) {
      throw new Error(`[LocalProvider] Item not found for patch: ${id}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = this.serializer.parse(content);

    // Merge fields into frontmatter
    const updated = {
      ...parsed.frontmatter,
      ...fields,
      updated: new Date().toISOString(),
    };

    const newContent = this.serializer.serialize(updated, parsed.body);
    fs.writeFileSync(filePath, newContent, 'utf8');

    return { id, patched: Object.keys(fields) };
  }

  async remove(id, archive = true) {
    const filePath = this._pathFor(id);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`[LocalProvider] Item not found for removal: ${id}`);
    }

    if (archive) {
      const dir = path.dirname(filePath);
      const archiveDir = path.join(dir, '_archive');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      const archivePath = path.join(archiveDir, path.basename(filePath));
      fs.renameSync(filePath, archivePath);
    } else {
      fs.unlinkSync(filePath);
    }

    this._pathCache.delete(id);
  }

  // ─── LIFECYCLE ──────────────────────────────────────

  async healthCheck() {
    try {
      const exists = fs.existsSync(this.basePath);
      return { healthy: exists, provider: 'local' };
    } catch (err) {
      return { healthy: false, provider: 'local', error: err.message };
    }
  }

  async close() {
    this._pathCache.clear();
  }

  // ─── HELPERS ────────────────────────────────────────

  /**
   * List all .md files in a directory (non-recursive by default, recursive for squads).
   * @private
   */
  _listMdFiles(dir) {
    const results = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith('.md')) {
          results.push(fullPath);
        } else if (entry.isDirectory()) {
          // Check for index/main file inside subdirectories
          const indexFile = path.join(fullPath, 'index.md');
          const mainFile = path.join(fullPath, `${entry.name}.md`);
          if (fs.existsSync(indexFile)) {
            results.push(indexFile);
          } else if (fs.existsSync(mainFile)) {
            results.push(mainFile);
          }
        }
      }
    } catch {
      // Directory not readable
    }

    return results;
  }

  /**
   * Normalize frontmatter from different file formats into a consistent shape.
   * Agent files use nested { agent: { id, name } } while memory types use flat { type, id }.
   * @private
   */
  _normalizeFrontmatter(fm, type, filePath) {
    // Already normalized (has type + id at top level)
    if (fm.type && fm.id) return fm;

    // Agent format: { agent: { id, name, ... }, persona: { ... }, ... }
    if (fm.agent) {
      return {
        type: 'agent',
        id: fm.agent.id ? `agent-${fm.agent.id}` : `agent-${path.basename(filePath, '.md')}`,
        name: fm.agent.name || fm.agent.title || '',
        summary: fm.persona?.role || fm.agent.title || '',
        status: fm.agent.status || 'active',
        updated: fm.updated || '',
        ...fm,
      };
    }

    // Fallback: derive from filename
    const basename = path.basename(filePath, '.md');
    return {
      type: type || 'unknown',
      id: basename,
      summary: fm.summary || fm.description || '',
      status: fm.status || 'active',
      updated: fm.updated || fm.date || '',
      ...fm,
    };
  }
}

module.exports = LocalProvider;
