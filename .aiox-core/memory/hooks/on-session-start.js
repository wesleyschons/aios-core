'use strict';

const { ContextPacker } = require('../serializers/context-packer');

/**
 * on-session-start hook - Loads context at the beginning of a work session.
 *
 * Returns a compact context object with project overview, recent sessions,
 * and recent decisions. Respects token budget via ContextPacker.
 *
 * @param {object} memoryBus - Initialized MemoryBus instance
 * @param {object} context - { projectId, executor }
 * @returns {Promise<object>} Session context for injection into agent prompt
 */
async function onSessionStart(memoryBus, context = {}) {
  const { projectId, executor } = context;

  // 1. Load project overview (L1)
  let project = {};
  if (projectId) {
    try {
      project = await memoryBus.getContext(`project-${projectId}`, 'project');
    } catch {
      // Project not found - that's OK for new projects
    }
  }

  // 2. Load recent sessions (L1)
  let recentSessions = [];
  try {
    recentSessions = await memoryBus.recent('session', {
      project: projectId,
      limit: 3,
    });
  } catch {
    // No sessions yet
  }

  // 3. Load recent decisions (L1)
  let recentDecisions = [];
  try {
    recentDecisions = await memoryBus.recent('decision', {
      project: projectId,
      limit: 3,
    });
  } catch {
    // No decisions yet
  }

  // 4. Build context object
  const sessionContext = {
    project: {
      name: project.name || projectId || 'unknown',
      current_focus: project.current_focus || null,
      blockers: project.blockers || [],
      next_actions: project.next_actions || [],
    },
    recent_work: recentSessions.map((s) => ({
      date: s.date || s.updated,
      summary: s.summary || '',
      next: s.next_session_context || '',
    })),
    recent_decisions: recentDecisions.map((d) => ({
      id: d.id,
      summary: d.summary || '',
      date: d.date || d.updated,
    })),
    _meta: {
      executor: executor || 'unknown',
      loaded_at: new Date().toISOString(),
      tokens_estimated: null,
    },
  };

  // 5. Pack within token budget
  const packed = ContextPacker.pack(sessionContext, 'session_start');
  sessionContext._meta.tokens_estimated = packed.tokenCount;

  if (!packed.withinBudget) {
    console.warn(`[Memory] Session context is ${packed.tokenCount} tokens (budget: 1500). Some data was trimmed.`);
  }

  return packed.data;
}

module.exports = onSessionStart;
