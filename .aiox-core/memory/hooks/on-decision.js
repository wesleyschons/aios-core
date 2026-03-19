'use strict';

/**
 * on-decision hook - Persists a decision record (ADR).
 *
 * Called when an agent or user makes a notable decision.
 *
 * @param {object} memoryBus - Initialized MemoryBus instance
 * @param {object} context - { projectId, executor }
 * @param {object} decisionData - { id?, slug, summary, decision, rationale, alternatives?, consequences?, decidedBy?, participants?, tags? }
 * @returns {Promise<string>} Decision ID
 */
async function onDecision(memoryBus, context = {}, decisionData = {}) {
  const { projectId, executor } = context;
  const dateStr = new Date().toISOString().substring(0, 10);
  const slug = decisionData.slug || decisionData.summary?.substring(0, 30).replace(/\s+/g, '-').toLowerCase() || 'unnamed';
  const decisionId = decisionData.id || `dec-${dateStr}-${slug}`;

  await memoryBus.write(decisionId, {
    type: 'decision',
    frontmatter: {
      summary: decisionData.summary || '',
      decision: decisionData.decision || '',
      rationale: decisionData.rationale || '',
      status: 'accepted',
      alternatives_considered: decisionData.alternatives || [],
      consequences: decisionData.consequences || [],
      decided_by: decisionData.decidedBy || 'wesley',
      participants: decisionData.participants || [executor || 'unknown'],
      date: dateStr,
      project: projectId || null,
      supersedes: decisionData.supersedes || null,
      tags: ['decision', ...(decisionData.tags || [])],
    },
  });

  return decisionId;
}

module.exports = onDecision;
