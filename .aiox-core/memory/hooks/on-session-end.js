'use strict';

/**
 * on-session-end hook - Persists session log at the end of a work session.
 *
 * Writes the session record and updates the project overview with
 * current_focus and next_actions.
 *
 * @param {object} memoryBus - Initialized MemoryBus instance
 * @param {object} context - { projectId, executor, startTime }
 * @param {object} sessionData - { summary, actions, decisions, filesChanged, nextContext, nextFocus, nextActions, tokensIn, tokensOut }
 */
async function onSessionEnd(memoryBus, context = {}, sessionData = {}) {
  const { projectId, executor, startTime } = context;
  const now = new Date();
  const start = startTime ? new Date(startTime) : now;
  const dateStr = now.toISOString().replace(/[:.]/g, '-').substring(0, 16);
  const sessionId = `sess-${dateStr}`;

  // 1. Write session log
  await memoryBus.write(sessionId, {
    type: 'session',
    frontmatter: {
      summary: sessionData.summary || 'Session ended',
      date: start.toISOString(),
      duration_minutes: Math.round((now - start) / 60000),
      actions: sessionData.actions || [],
      decisions_made: (sessionData.decisions || []).map((d) => d.id || d),
      files_changed: sessionData.filesChanged || [],
      next_session_context: sessionData.nextContext || '',
      tokens_input: sessionData.tokensIn || 0,
      tokens_output: sessionData.tokensOut || 0,
      executor: executor || 'unknown',
      project: projectId || null,
    },
  });

  // 2. Update project overview
  if (projectId) {
    try {
      await memoryBus.patch(`project-${projectId}`, {
        current_focus: sessionData.nextFocus || sessionData.summary || '',
        next_actions: sessionData.nextActions || [],
      }, 'project');
    } catch {
      // Project doesn't exist yet - that's OK
    }
  }

  console.log(`[Memory] Session ${sessionId} logged. ${(sessionData.actions || []).length} actions, ${(sessionData.decisions || []).length} decisions.`);
  return sessionId;
}

module.exports = onSessionEnd;
