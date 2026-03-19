'use strict';

/**
 * Schema definitions for memory item types.
 * Sprint 2 will add full validation — this is the structural placeholder.
 */

const SCHEMAS = {
  agent: {
    required: ['type', 'id', 'name'],
    optional: ['summary', 'status', 'squad', 'capabilities', 'dependencies', 'model', 'version'],
    l0Fields: ['id', 'type', 'summary', 'status', 'updated'],
  },
  squad: {
    required: ['type', 'id', 'name'],
    optional: ['summary', 'status', 'agents', 'pipeline_order', 'orchestration'],
    l0Fields: ['id', 'type', 'summary', 'status', 'updated'],
  },
  session: {
    required: ['type', 'id', 'date'],
    optional: ['project', 'summary', 'actions', 'decisions_made', 'files_changed', 'next_session_context', 'executor'],
    l0Fields: ['id', 'type', 'summary', 'status', 'updated'],
  },
  decision: {
    required: ['type', 'id', 'summary', 'decision'],
    optional: ['project', 'status', 'rationale', 'alternatives_considered', 'consequences', 'decided_by', 'date'],
    l0Fields: ['id', 'type', 'summary', 'status', 'updated'],
  },
  handoff: {
    required: ['type', 'id', 'from_agent', 'to_agent'],
    optional: ['project', 'summary', 'reason', 'context_transferred', 'key_constraints', 'state_snapshot'],
    l0Fields: ['id', 'type', 'summary', 'status', 'updated'],
  },
  component: {
    required: ['type', 'id', 'name'],
    optional: ['project', 'summary', 'layer', 'version', 'role', 'depends_on', 'api_endpoints'],
    l0Fields: ['id', 'type', 'summary', 'status', 'updated'],
  },
  project: {
    required: ['type', 'id', 'name'],
    optional: ['summary', 'status', 'phase', 'stack', 'current_focus', 'blockers', 'next_actions'],
    l0Fields: ['id', 'type', 'summary', 'status', 'updated'],
  },
  pipeline: {
    required: ['type', 'id', 'name'],
    optional: ['summary', 'status', 'steps', 'trigger'],
    l0Fields: ['id', 'type', 'summary', 'status', 'updated'],
  },
};

/**
 * Validate that required fields are present.
 * @param {string} type
 * @param {object} data
 * @returns {{valid: boolean, missing: string[]}}
 */
function validate(type, data) {
  const schema = SCHEMAS[type];
  if (!schema) return { valid: true, missing: [] };

  const missing = schema.required.filter(field => !data[field]);
  return { valid: missing.length === 0, missing };
}

module.exports = { SCHEMAS, validate };
