'use strict';

/**
 * on-handoff hook - Persists a handoff record between agents.
 *
 * Called when work transfers from one agent to another.
 *
 * @param {object} memoryBus - Initialized MemoryBus instance
 * @param {object} context - { projectId }
 * @param {object} handoffData - { slug, summary, from, to, reason, contextItems?, constraints?, completed?, pending?, dependencies? }
 * @returns {Promise<string>} Handoff ID
 */
async function onHandoff(memoryBus, context = {}, handoffData = {}) {
  const { projectId } = context;
  const dateStr = new Date().toISOString().substring(0, 10);
  const slug = handoffData.slug || `${handoffData.from}-to-${handoffData.to}`;
  const handoffId = `ho-${dateStr}-${slug}`;

  await memoryBus.write(handoffId, {
    type: 'handoff',
    frontmatter: {
      summary: handoffData.summary || `Handoff from ${handoffData.from} to ${handoffData.to}`,
      date: new Date().toISOString(),
      from_agent: handoffData.from || 'unknown',
      to_agent: handoffData.to || 'unknown',
      reason: handoffData.reason || '',
      context_transferred: handoffData.contextItems || [],
      key_constraints: handoffData.constraints || [],
      state_snapshot: {
        completed: handoffData.completed || [],
        pending: handoffData.pending || [],
      },
      depends_on: (handoffData.dependencies || []).map((d) => `[[${d}]]`),
      project: projectId || null,
      tags: ['handoff'],
    },
  });

  return handoffId;
}

module.exports = onHandoff;
