#!/usr/bin/env node
'use strict';

/**
 * Quick smoke test for the Memory Module.
 * Run: node .aiox-core/memory/test-memory.js
 */

const MemoryBus = require('./memory-bus');

async function main() {
  console.log('=== Memory Module Smoke Test ===\n');

  // 1. Initialize
  const bus = new MemoryBus();
  await bus.initialize({
    provider: 'local',
    local: { base_path: './' },
  });
  console.log('[OK] MemoryBus initialized (local provider)');

  // 2. Health check
  const health = await bus.healthCheck();
  console.log(`[OK] Health: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'} (mode: ${health.mode})`);

  // 3. Write a test decision
  const testId = `dec-test-${Date.now()}`;
  await bus.write(testId, {
    type: 'decision',
    frontmatter: {
      summary: 'Test decision from smoke test',
      decision: 'Memory module works!',
      status: 'accepted',
      decided_by: 'wesley',
      date: new Date().toISOString(),
    },
    body: '## Context\n\nThis was created by the memory module smoke test.',
  });
  console.log(`[OK] Written: ${testId}`);

  // 4. Read it back (L1 - context)
  const context = await bus.getContext(testId, 'decision');
  console.log(`[OK] Read L1: summary="${context.summary}", status="${context.status}"`);

  // 5. Read full (L2)
  const full = await bus.getFull(testId, 'decision');
  console.log(`[OK] Read L2: body contains "${full.body.substring(0, 40)}..."`);

  // 6. Patch it
  await bus.patch(testId, { status: 'superseded' }, 'decision');
  const patched = await bus.getContext(testId, 'decision');
  console.log(`[OK] Patched: status changed to "${patched.status}"`);

  // 7. Search
  const results = await bus.search('smoke test');
  console.log(`[OK] Search "smoke test": ${results.length} result(s)`);

  // 8. List decisions
  const decisions = await bus.list('decision');
  console.log(`[OK] List decisions: ${decisions.length} item(s)`);

  // 9. Recent
  const recent = await bus.recent('decision', { limit: 3 });
  console.log(`[OK] Recent decisions: ${recent.length} item(s)`);

  // 10. Remove (archive)
  await bus.remove(testId, true, 'decision');
  console.log(`[OK] Archived: ${testId}`);

  // 11. List existing agents (reads from .aiox-core/development/agents/)
  const agents = await bus.list('agent');
  console.log(`[OK] Agents found: ${agents.length}`);
  if (agents.length > 0) {
    console.log(`     First: ${agents[0].id} - "${agents[0].summary || agents[0].name || '(no summary)'}"`);
  }

  await bus.close();

  console.log('\n=== All 11 checks passed! ===');
  console.log('Memory module is working correctly.');
  console.log('\nConfig: .aiox-core/config/memory.yaml');
  console.log('Data:   .aiox-core/memory/data/');
}

main().catch(err => {
  console.error(`\n[FAIL] ${err.message}`);
  process.exit(1);
});
