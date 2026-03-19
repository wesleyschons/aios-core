'use strict';

/**
 * ContextPacker — Compacts context to fit within token budgets.
 *
 * Uses progressive reduction: removes least important fields first
 * until the data fits within the budget.
 */
class ContextPacker {

  static TOKEN_BUDGETS = {
    session_start: 1500,
    agent_context: 500,
    component_context: 800,
    search_results: 1000,
  };

  /**
   * Compact data to fit within a token budget.
   * @param {object} data - Data to compact
   * @param {string|number} [budget='session_start'] - Budget name or number
   * @returns {{data: object, tokenCount: number, withinBudget: boolean}}
   */
  static pack(data, budget = 'session_start') {
    const maxTokens = typeof budget === 'number'
      ? budget
      : (this.TOKEN_BUDGETS[budget] || 1500);

    const packed = JSON.parse(JSON.stringify(data));
    let currentTokens = this.estimateTokens(packed);

    const reductions = [
      () => { delete packed._meta; },
      () => { if (packed.recent_work?.length > 2) packed.recent_work = packed.recent_work.slice(0, 2); },
      () => { packed.recent_decisions?.forEach(d => delete d.alternatives_considered); },
      () => { this._truncateSummaries(packed, 100); },
      () => { delete packed.recent_decisions; },
      () => { this._stripOptionalFields(packed); },
    ];

    for (const reduce of reductions) {
      if (currentTokens <= maxTokens) break;
      reduce();
      currentTokens = this.estimateTokens(packed);
    }

    return {
      data: packed,
      tokenCount: currentTokens,
      withinBudget: currentTokens <= maxTokens,
    };
  }

  /**
   * Estimate token count (~4 chars = 1 token).
   * @param {*} data
   * @returns {number}
   */
  static estimateTokens(data) {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    return Math.ceil(json.length / 4);
  }

  /** @private */
  static _truncateSummaries(obj, maxLen) {
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, val] of Object.entries(obj)) {
        if (key === 'summary' && typeof val === 'string' && val.length > maxLen) {
          obj[key] = val.substring(0, maxLen) + '...';
        } else if (typeof val === 'object') {
          this._truncateSummaries(val, maxLen);
        }
      }
    }
  }

  /** @private */
  static _stripOptionalFields(obj) {
    const optional = ['tags', 'created', 'run_count', 'avg_tokens_per_run', 'version'];
    if (typeof obj === 'object' && obj !== null) {
      for (const field of optional) {
        delete obj[field];
      }
      for (const val of Object.values(obj)) {
        if (typeof val === 'object') this._stripOptionalFields(val);
      }
    }
  }
}

module.exports = { ContextPacker };
