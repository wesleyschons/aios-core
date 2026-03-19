'use strict';

/**
 * Memory hooks — Auto-logging for the AIOS pipeline.
 * Sprint 3 will implement these fully.
 * For now, export stubs that can be wired into the pipeline.
 */

// Placeholders — will be implemented in Sprint 3
const onSessionStart = require('./on-session-start');
const onSessionEnd = require('./on-session-end');
const onDecision = require('./on-decision');
const onHandoff = require('./on-handoff');

module.exports = {
  onSessionStart,
  onSessionEnd,
  onDecision,
  onHandoff,
};
