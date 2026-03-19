'use strict';

/**
 * MemoryProvider — Abstract base class for all memory providers.
 *
 * Every provider MUST extend this class and implement all methods.
 * Default implementations throw "Not implemented" to enforce the contract.
 *
 * Resolution levels:
 *   L0 (~2 tokens/item): id, type, summary, status — for listings
 *   L1 (~100-300 tokens): full frontmatter without body — for working context
 *   L2 (~1000-5000 tokens): complete document — only when directly working on item
 */
class MemoryProvider {
  constructor(name) {
    if (new.target === MemoryProvider) {
      throw new Error('MemoryProvider is abstract and cannot be instantiated directly');
    }
    this.name = name;
  }

  // ─── READ ───────────────────────────────────────────

  /**
   * List items of a type. Returns L0 (id + summary).
   * Target cost: ~2 tokens per item.
   * @param {string} type - "agent" | "squad" | "session" | "decision" | "handoff" | "component"
   * @param {object} [filters] - { project?, status?, since?, limit? }
   * @returns {Promise<Array<{id: string, type: string, summary: string, status: string, updated: string}>>}
   */
  async list(_type, _filters = {}) {
    throw new Error(`${this.name}: list() not implemented`);
  }

  /**
   * Return operational context (L1) — frontmatter without body.
   * Target cost: ~100-300 tokens.
   * @param {string} id - Item ID
   * @returns {Promise<object>} Full frontmatter object
   */
  async getContext(_id) {
    throw new Error(`${this.name}: getContext() not implemented`);
  }

  /**
   * Return complete document (L2) — frontmatter + body.
   * Target cost: ~1000-5000 tokens.
   * @param {string} id - Item ID
   * @returns {Promise<{frontmatter: object, body: string}>}
   */
  async getFull(_id) {
    throw new Error(`${this.name}: getFull() not implemented`);
  }

  /**
   * Full-text search in vault/filesystem.
   * Returns L0 of matching results.
   * @param {string} query - Search text
   * @param {object} [scope] - { type?, project?, limit? }
   * @returns {Promise<Array<{id: string, type: string, summary: string, relevance: number}>>}
   */
  async search(_query, _scope = {}) {
    throw new Error(`${this.name}: search() not implemented`);
  }

  /**
   * Return the N most recent items of a type.
   * Returns L1 of each.
   * @param {string} type
   * @param {object} [opts] - { project?, limit? }
   * @returns {Promise<Array<object>>} Frontmatter of each item
   */
  async recent(_type, _opts = {}) {
    throw new Error(`${this.name}: recent() not implemented`);
  }

  // ─── WRITE ──────────────────────────────────────────

  /**
   * Create or update an item.
   * @param {string} id
   * @param {object} data - { type, frontmatter, body? }
   * @param {object} [opts] - { section?, merge? }
   * @returns {Promise<{id: string, path: string, written: boolean}>}
   */
  async write(_id, _data, _opts = {}) {
    throw new Error(`${this.name}: write() not implemented`);
  }

  /**
   * Update only specific frontmatter fields.
   * Does not touch the body. Ideal for status/focus updates.
   * @param {string} id
   * @param {object} fields - Fields to update
   * @returns {Promise<{id: string, patched: string[]}>}
   */
  async patch(_id, _fields) {
    throw new Error(`${this.name}: patch() not implemented`);
  }

  /**
   * Delete an item (or move to archive).
   * @param {string} id
   * @param {boolean} [archive=true] - If true, moves instead of deleting
   * @returns {Promise<void>}
   */
  async remove(_id, _archive = true) {
    throw new Error(`${this.name}: remove() not implemented`);
  }

  // ─── LIFECYCLE ──────────────────────────────────────

  /**
   * Initialize the provider with configuration.
   * @param {object} config - Provider-specific config from memory.yaml
   * @returns {Promise<void>}
   */
  async initialize(_config) {
    throw new Error(`${this.name}: initialize() not implemented`);
  }

  /**
   * Check if the provider is healthy and can serve requests.
   * @returns {Promise<{healthy: boolean, provider: string, error?: string}>}
   */
  async healthCheck() {
    throw new Error(`${this.name}: healthCheck() not implemented`);
  }

  /**
   * Cleanup resources on shutdown.
   * @returns {Promise<void>}
   */
  async close() {
    // Default: no-op (override if needed)
  }
}

const MEMORY_TYPES = [
  'agent',
  'squad',
  'session',
  'decision',
  'handoff',
  'component',
  'project',
  'pipeline',
];

const METHODS = [
  'list',
  'getContext',
  'getFull',
  'search',
  'recent',
  'write',
  'patch',
  'remove',
  'initialize',
  'healthCheck',
  'close',
];

module.exports = { MemoryProvider, MEMORY_TYPES, METHODS };
