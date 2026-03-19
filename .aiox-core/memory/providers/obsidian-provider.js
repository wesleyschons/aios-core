'use strict';

const https = require('https');
const http = require('http');
const { MemoryProvider } = require('./provider-interface');
const { FrontmatterSerializer } = require('../serializers/frontmatter');

/**
 * ObsidianProvider - Obsidian vault via Local REST API.
 *
 * Connects to the obsidian-local-rest-api plugin over HTTPS/HTTP
 * to read, write, search, and manage notes in the vault.
 */
class ObsidianProvider extends MemoryProvider {
  constructor() {
    super('obsidian');
    this.host = '127.0.0.1';
    this.port = 27124;
    this.useHttps = true;
    this.apiKey = null;
    this.projectFolder = 'projects/_global';
    this.serializer = new FrontmatterSerializer();
  }

  async initialize(config = {}) {
    this.apiKey = config.api_key || process.env.OBSIDIAN_API_KEY || null;
    this.host = config.host || process.env.OBSIDIAN_HOST || '127.0.0.1';
    this.port = config.port || parseInt(process.env.OBSIDIAN_PORT || '27124', 10);
    this.useHttps = this.port === 27124;
    this.projectFolder = (config.project_folder || 'projects/{{project_id}}')
      .replace('{{project_id}}', config.project_id || '_global');

    if (!this.apiKey) {
      throw new Error('[ObsidianProvider] No API key. Set obsidian.api_key in memory.yaml or OBSIDIAN_API_KEY env var.');
    }
  }

  // -- PATH MAPPING --------------------------------------------------------

  _folderFor(type, projectId) {
    const globalTypes = ['agent', 'squad', 'pipeline'];
    if (globalTypes.includes(type)) {
      return `_nucleus/${type}s`;
    }
    const base = projectId
      ? this.projectFolder.replace('_global', projectId)
      : this.projectFolder;
    return `${base}/${type}s`;
  }

  _pathFor(type, id, projectId) {
    const folder = this._folderFor(type, projectId);
    const slug = id.replace(/^(agent|squad|sess|dec|ho|comp|project|pipeline)-/, '');
    return `${folder}/${slug}.md`;
  }

  // -- HTTP CLIENT ---------------------------------------------------------

  _request(method, urlPath, body, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        ...extraHeaders,
      };

      if (body && !headers['Content-Type']) {
        headers['Content-Type'] = 'text/markdown';
      }

      const options = {
        hostname: this.host,
        port: this.port,
        path: encodeURI(urlPath),
        method,
        headers,
        rejectUnauthorized: false, // Self-signed cert from Obsidian
      };

      const transport = this.useHttps ? https : http;
      const req = transport.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 400) {
            reject(new Error(`[ObsidianProvider] ${method} ${urlPath} -> ${res.statusCode}: ${raw}`));
            return;
          }
          resolve({ status: res.statusCode, body: raw, headers: res.headers });
        });
      });

      req.on('error', (err) => reject(new Error(`[ObsidianProvider] ${method} ${urlPath} failed: ${err.message}`)));
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('[ObsidianProvider] Request timed out')); });

      if (body) req.write(body);
      req.end();
    });
  }

  async _getFile(vaultPath) {
    const res = await this._request('GET', `/vault/${vaultPath}`, null, {
      'Accept': 'text/markdown',
    });
    return res.body;
  }

  async _getFileJson(vaultPath) {
    const res = await this._request('GET', `/vault/${vaultPath}`, null, {
      'Accept': 'application/vnd.olrapi.note+json',
    });
    return JSON.parse(res.body);
  }

  async _putFile(vaultPath, content) {
    await this._request('PUT', `/vault/${vaultPath}`, content, {
      'Content-Type': 'text/markdown',
    });
  }

  async _deleteFile(vaultPath) {
    await this._request('DELETE', `/vault/${vaultPath}`);
  }

  async _listDir(vaultPath) {
    const res = await this._request('GET', `/vault/${vaultPath}/`);
    const data = JSON.parse(res.body);
    return data.files || [];
  }

  async _search(query, contextLength = 100) {
    const res = await this._request(
      'POST',
      `/search/simple/?query=${encodeURIComponent(query)}&contextLength=${contextLength}`,
      '',
      { 'Content-Type': 'application/json' },
    );
    return JSON.parse(res.body);
  }

  // -- READ ----------------------------------------------------------------

  async list(type, filters = {}) {
    const folder = this._folderFor(type, filters.project);
    let files;
    try {
      files = await this._listDir(folder);
    } catch {
      return []; // Folder doesn't exist yet
    }

    const results = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      try {
        const json = await this._getFileJson(file);
        const fm = json.frontmatter || {};
        if (filters.status && fm.status !== filters.status) continue;
        results.push(this.serializer.toL0({
          id: fm.id || file.replace(/\.md$/, '').split('/').pop(),
          type: fm.type || type,
          summary: fm.summary || '',
          status: fm.status || 'active',
          updated: fm.updated || fm.date || '',
        }));
      } catch {
        // Skip unreadable files
      }
    }

    return results.slice(0, filters.limit || 50);
  }

  async getContext(id) {
    const filePath = await this._findFile(id);
    const json = await this._getFileJson(filePath);
    return json.frontmatter || {};
  }

  async getFull(id) {
    const filePath = await this._findFile(id);
    const content = await this._getFile(filePath);
    return this.serializer.parse(content);
  }

  async search(query, scope = {}) {
    const raw = await this._search(query);
    const results = raw.map((r) => ({
      id: r.filename.replace(/\.md$/, '').split('/').pop(),
      type: this._inferTypeFromPath(r.filename),
      summary: (r.matches && r.matches[0]?.match) || '',
      relevance: r.score || 0,
    }));

    if (scope.type) {
      return results.filter((r) => r.type === scope.type).slice(0, scope.limit || 10);
    }
    return results.slice(0, scope.limit || 10);
  }

  async recent(type, opts = {}) {
    const items = await this.list(type, { project: opts.project, limit: opts.limit || 5 });
    // Items from list are already L0, upgrade to L1
    const detailed = [];
    for (const item of items) {
      try {
        const ctx = await this.getContext(item.id);
        detailed.push(ctx);
      } catch {
        detailed.push(item);
      }
    }
    return detailed;
  }

  // -- WRITE ---------------------------------------------------------------

  async write(id, data, _opts = {}) {
    const type = data.type;
    const vaultPath = this._pathFor(type, id, data.frontmatter?.project);
    const fm = { ...data.frontmatter, id, type, updated: new Date().toISOString() };
    const content = this.serializer.serialize(fm, data.body || '');

    await this._putFile(vaultPath, content);
    return { id, path: vaultPath, written: true };
  }

  async patch(id, fields) {
    const filePath = await this._findFile(id);
    const content = await this._getFile(filePath);
    const parsed = this.serializer.parse(content);

    const updated = { ...parsed.frontmatter, ...fields, updated: new Date().toISOString() };
    const newContent = this.serializer.serialize(updated, parsed.body);

    await this._putFile(filePath, newContent);
    return { id, patched: Object.keys(fields) };
  }

  async remove(id, archive = true) {
    const filePath = await this._findFile(id);

    if (archive) {
      // Move to _archive folder by reading, writing to archive, then deleting
      const content = await this._getFile(filePath);
      const archivePath = filePath.replace(/\/([^/]+)$/, '/_archive/$1');
      await this._putFile(archivePath, content);
    }

    await this._deleteFile(filePath);
  }

  // -- LIFECYCLE -----------------------------------------------------------

  async healthCheck() {
    try {
      const res = await this._request('GET', '/');
      const data = JSON.parse(res.body);
      return {
        healthy: data.authenticated === true,
        provider: 'obsidian',
        service: data.service,
      };
    } catch (err) {
      return { healthy: false, provider: 'obsidian', error: err.message };
    }
  }

  async close() {
    // No persistent connection to close
  }

  // -- HELPERS -------------------------------------------------------------

  async _findFile(id) {
    // Try common type prefixes
    const prefixMap = {
      'sess-': 'session', 'dec-': 'decision', 'ho-': 'handoff',
      'comp-': 'component', 'agent-': 'agent', 'squad-': 'squad',
      'project-': 'project', 'pipeline-': 'pipeline',
    };

    let type = null;
    for (const [prefix, t] of Object.entries(prefixMap)) {
      if (id.startsWith(prefix)) { type = t; break; }
    }

    if (type) {
      const path = this._pathFor(type, id);
      try {
        await this._getFile(path);
        return path;
      } catch {
        // Not found at expected path, try search
      }
    }

    // Fallback: search by id
    const results = await this._search(id);
    if (results.length > 0) {
      return results[0].filename;
    }

    throw new Error(`[ObsidianProvider] File not found for id: ${id}`);
  }

  _inferTypeFromPath(filepath) {
    if (filepath.includes('/sessions/')) return 'session';
    if (filepath.includes('/decisions/')) return 'decision';
    if (filepath.includes('/handoffs/')) return 'handoff';
    if (filepath.includes('/components/')) return 'component';
    if (filepath.includes('/agents/')) return 'agent';
    if (filepath.includes('/squads/')) return 'squad';
    if (filepath.includes('/pipelines/')) return 'pipeline';
    if (filepath.includes('/projects/')) return 'project';
    return 'unknown';
  }
}

module.exports = ObsidianProvider;
