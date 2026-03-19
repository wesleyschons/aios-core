'use strict';

const fs = require('fs');
const path = require('path');
const LocalProvider = require('./providers/local-provider');
const { MEMORY_TYPES } = require('./providers/provider-interface');

/**
 * MemoryBus — Unified memory interface that routes operations
 * to the correct provider based on configuration.
 *
 * Supports three modes:
 *   - local:    All operations go to filesystem (default)
 *   - obsidian: All operations go to Obsidian vault via MCP
 *   - hybrid:   Routes by type (agents/tasks local, sessions/decisions Obsidian)
 *
 * Usage:
 *   const bus = new MemoryBus();
 *   await bus.initialize();
 *   const agents = await bus.list('agent');
 *   await bus.close();
 */
class MemoryBus {
  /**
   * @param {string} [configPath] - Path to memory.yaml config file
   */
  constructor(configPath) {
    this._configPath = configPath || null;
    this.config = null;
    this.providers = {};
    this.routingTable = {};
    this._initialized = false;
  }

  /**
   * Initialize the bus: load config, create providers, build routing table.
   * @param {object} [overrideConfig] - Override config instead of reading from file
   * @returns {Promise<void>}
   */
  async initialize(overrideConfig) {
    if (this._initialized) return;

    this.config = overrideConfig || this._loadConfig();
    const mode = this.config.provider || 'local';

    // Initialize providers based on mode
    if (mode === 'local' || mode === 'hybrid') {
      this.providers.local = new LocalProvider();
      await this.providers.local.initialize(this.config.local || {});
    }

    if (mode === 'obsidian' || mode === 'hybrid') {
      try {
        const ObsidianProvider = require('./providers/obsidian-provider');
        this.providers.obsidian = new ObsidianProvider();
        await this.providers.obsidian.initialize(this.config.obsidian || {});
      } catch (err) {
        if (mode === 'obsidian') {
          throw new Error(`[MemoryBus] Obsidian provider required but failed to load: ${err.message}`);
        }
        // In hybrid mode, warn but continue with local only
        console.warn(`[MemoryBus] Obsidian provider not available, falling back to local: ${err.message}`);
      }
    }

    // Build routing table
    this._buildRoutingTable(mode);
    this._initialized = true;
  }

  // ─── PUBLIC API ─────────────────────────────────────

  /**
   * List items of a type. Returns L0.
   * @param {string} type
   * @param {object} [filters]
   * @returns {Promise<Array>}
   */
  async list(type, filters) {
    this._assertInitialized();
    const provider = await this._resolveWithFallback(type);
    return provider.list(type, filters);
  }

  /**
   * Get operational context (L1) for an item.
   * @param {string} id
   * @param {string} [type] - Helps routing in hybrid mode
   * @returns {Promise<object>}
   */
  async getContext(id, type) {
    this._assertInitialized();
    const provider = await this._resolveWithFallback(type || this._inferType(id));
    return provider.getContext(id);
  }

  /**
   * Get complete document (L2) for an item.
   * @param {string} id
   * @param {string} [type]
   * @returns {Promise<{frontmatter: object, body: string}>}
   */
  async getFull(id, type) {
    this._assertInitialized();
    const provider = await this._resolveWithFallback(type || this._inferType(id));
    return provider.getFull(id);
  }

  /**
   * Full-text search. Prefers Obsidian if available (superior full-text).
   * @param {string} query
   * @param {object} [scope]
   * @returns {Promise<Array>}
   */
  async search(query, scope) {
    this._assertInitialized();
    // Search always goes to Obsidian if available (better full-text)
    if (this.providers.obsidian) {
      try {
        const health = await this.providers.obsidian.healthCheck();
        if (health.healthy) {
          return this.providers.obsidian.search(query, scope);
        }
      } catch {
        // Fall through to local
      }
    }
    return this.providers.local.search(query, scope);
  }

  /**
   * Get N most recent items of a type. Returns L1.
   * @param {string} type
   * @param {object} [opts]
   * @returns {Promise<Array>}
   */
  async recent(type, opts) {
    this._assertInitialized();
    const provider = await this._resolveWithFallback(type);
    return provider.recent(type, opts);
  }

  /**
   * Create or update an item.
   * @param {string} id
   * @param {object} data - { type, frontmatter, body? }
   * @param {object} [opts]
   * @returns {Promise<{id, path, written}>}
   */
  async write(id, data, opts) {
    this._assertInitialized();
    const type = data.type;
    if (!type) {
      throw new Error('[MemoryBus] write() requires data.type');
    }

    const provider = await this._resolveWithFallback(type);
    const result = await provider.write(id, data, opts);

    // Write-through: if hybrid and primary is local, replicate to Obsidian
    if (this.config.provider === 'hybrid'
        && this.config.obsidian?.sync_mode === 'write-through'
        && this._getProviderName(type) === 'local'
        && this.providers.obsidian) {
      this.providers.obsidian.write(id, data, opts).catch(err => {
        console.warn(`[MemoryBus] Obsidian sync failed for ${id}: ${err.message}`);
      });
    }

    return result;
  }

  /**
   * Update specific frontmatter fields.
   * @param {string} id
   * @param {object} fields
   * @param {string} [type]
   * @returns {Promise<{id, patched}>}
   */
  async patch(id, fields, type) {
    this._assertInitialized();
    const provider = await this._resolveWithFallback(type || this._inferType(id));
    return provider.patch(id, fields);
  }

  /**
   * Remove an item.
   * @param {string} id
   * @param {boolean} [archive=true]
   * @param {string} [type]
   * @returns {Promise<void>}
   */
  async remove(id, archive = true, type) {
    this._assertInitialized();
    const provider = await this._resolveWithFallback(type || this._inferType(id));
    return provider.remove(id, archive);
  }

  /**
   * Health check all providers.
   * @returns {Promise<object>}
   */
  async healthCheck() {
    const results = {};
    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        results[name] = await provider.healthCheck();
      } catch (err) {
        results[name] = { healthy: false, provider: name, error: err.message };
      }
    }
    return {
      mode: this.config?.provider || 'unknown',
      providers: results,
      healthy: Object.values(results).some(r => r.healthy),
    };
  }

  /**
   * Shutdown all providers.
   * @returns {Promise<void>}
   */
  async close() {
    for (const provider of Object.values(this.providers)) {
      await provider.close();
    }
    this.providers = {};
    this._initialized = false;
  }

  // ─── INTERNAL ───────────────────────────────────────

  /**
   * Load config from memory.yaml.
   * @returns {object}
   * @private
   */
  _loadConfig() {
    const searchPaths = [
      this._configPath,
      path.join(process.cwd(), '.aiox-core', 'config', 'memory.yaml'),
      path.join(process.cwd(), '.aios-core', 'config', 'memory.yaml'),
    ].filter(Boolean);

    for (const configPath of searchPaths) {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        // Simple YAML parse for the config structure
        return this._parseSimpleYaml(content);
      }
    }

    // Default config if no file found
    return {
      provider: 'local',
      local: { base_path: './' },
    };
  }

  /**
   * Minimal YAML parser for the config file structure.
   * @private
   */
  _parseSimpleYaml(content) {
    const { FrontmatterSerializer } = require('./serializers/frontmatter');
    const serializer = new FrontmatterSerializer();

    // Wrap in frontmatter delimiters so we can reuse the parser
    const wrapped = `---\n${content}\n---\n`;
    const { frontmatter } = serializer.parse(wrapped);

    // The config is nested under "memory" key
    return frontmatter.memory || frontmatter;
  }

  /**
   * Build the routing table based on mode.
   * @private
   */
  _buildRoutingTable(mode) {
    if (mode === 'hybrid' && this.config.hybrid) {
      const h = this.config.hybrid;
      if (Array.isArray(h.local_for)) {
        for (const type of h.local_for) {
          this.routingTable[type] = 'local';
        }
      }
      if (Array.isArray(h.obsidian_for)) {
        for (const type of h.obsidian_for) {
          // Only route to obsidian if provider is available
          this.routingTable[type] = this.providers.obsidian ? 'obsidian' : 'local';
        }
      }
      // Default unmapped types to local
      for (const type of MEMORY_TYPES) {
        if (!this.routingTable[type]) {
          this.routingTable[type] = 'local';
        }
      }
    } else {
      // Pure mode: everything goes to the same provider
      const providerName = this.providers[mode] ? mode : 'local';
      for (const type of MEMORY_TYPES) {
        this.routingTable[type] = providerName;
      }
    }
  }

  /**
   * Get the configured provider name for a type.
   * @private
   */
  _getProviderName(type) {
    return this.routingTable[type] || 'local';
  }

  /**
   * Resolve provider for a type, with health-check fallback to local.
   * @private
   */
  async _resolveWithFallback(type) {
    const providerName = this._getProviderName(type);
    const provider = this.providers[providerName];

    if (!provider) {
      if (this.providers.local) return this.providers.local;
      throw new Error(`[MemoryBus] No provider available for type "${type}"`);
    }

    // For non-local providers, check health and fallback
    if (providerName !== 'local' && this.providers.local) {
      try {
        const health = await provider.healthCheck();
        if (!health.healthy) {
          console.warn(`[MemoryBus] ${providerName} unhealthy, falling back to local`);
          return this.providers.local;
        }
      } catch {
        console.warn(`[MemoryBus] ${providerName} health check failed, falling back to local`);
        return this.providers.local;
      }
    }

    return provider;
  }

  /**
   * Infer type from ID prefix.
   * @private
   */
  _inferType(id) {
    if (!id) return 'unknown';
    const prefixMap = {
      'agent-': 'agent',
      'squad-': 'squad',
      'sess-': 'session',
      'dec-': 'decision',
      'ho-': 'handoff',
      'comp-': 'component',
      'project-': 'project',
      'pipeline-': 'pipeline',
    };
    for (const [prefix, type] of Object.entries(prefixMap)) {
      if (id.startsWith(prefix)) return type;
    }
    return 'unknown';
  }

  /**
   * Assert the bus is initialized.
   * @private
   */
  _assertInitialized() {
    if (!this._initialized) {
      throw new Error('[MemoryBus] Not initialized. Call initialize() first.');
    }
  }
}

module.exports = MemoryBus;
