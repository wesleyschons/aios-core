'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MemoryBus = require('../../.aiox-core/memory/memory-bus');
const onSessionStart = require('../../.aiox-core/memory/hooks/on-session-start');
const onSessionEnd = require('../../.aiox-core/memory/hooks/on-session-end');
const onDecision = require('../../.aiox-core/memory/hooks/on-decision');
const onHandoff = require('../../.aiox-core/memory/hooks/on-handoff');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-hooks-test-'));
}

describe('Memory Hooks', () => {
  let tmpDir;
  let bus;

  beforeEach(async () => {
    tmpDir = createTempDir();
    bus = new MemoryBus();
    await bus.initialize({
      provider: 'local',
      local: { base_path: tmpDir },
    });
  });

  afterEach(async () => {
    await bus.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('onSessionStart', () => {
    it('returns empty context when no data exists', async () => {
      const ctx = await onSessionStart(bus, { projectId: 'test' });
      expect(ctx.project.name).toBe('test');
      expect(ctx.recent_work).toEqual([]);
      expect(ctx.recent_decisions).toEqual([]);
    });

    it('loads recent sessions and decisions', async () => {
      // Seed data
      await bus.write('sess-old', {
        type: 'session',
        frontmatter: { summary: 'Did stuff', date: '2026-03-17', next_session_context: 'Continue X' },
      });
      await bus.write('dec-arch', {
        type: 'decision',
        frontmatter: { summary: 'Chose local', decision: 'Use local FS', date: '2026-03-17' },
      });

      const ctx = await onSessionStart(bus, { projectId: 'test', executor: 'claude' });
      expect(ctx.recent_work.length).toBe(1);
      expect(ctx.recent_work[0].summary).toBe('Did stuff');
      expect(ctx.recent_decisions.length).toBe(1);
      expect(ctx.recent_decisions[0].summary).toBe('Chose local');
    });
  });

  describe('onSessionEnd', () => {
    it('writes session log', async () => {
      const sessionId = await onSessionEnd(bus, {
        projectId: 'test',
        executor: 'claude',
        startTime: new Date(Date.now() - 30 * 60000).toISOString(),
      }, {
        summary: 'Implemented memory module',
        actions: ['Created provider', 'Added tests'],
        decisions: [{ id: 'dec-test' }],
        filesChanged: ['memory-bus.js'],
        nextContext: 'Continue with hooks',
      });

      expect(sessionId).toMatch(/^sess-/);
      const sessions = await bus.list('session');
      expect(sessions.length).toBe(1);

      const full = await bus.getFull(sessionId, 'session');
      expect(full.frontmatter.summary).toBe('Implemented memory module');
      expect(full.frontmatter.actions).toContain('Created provider');
    });
  });

  describe('onDecision', () => {
    it('writes decision record', async () => {
      const decId = await onDecision(bus, {
        projectId: 'test',
        executor: 'claude',
      }, {
        slug: 'use-local',
        summary: 'Use local filesystem',
        decision: 'Store everything on local FS',
        rationale: 'Zero latency for hot path',
        alternatives: ['Obsidian only'],
        consequences: ['No graph view'],
      });

      expect(decId).toMatch(/^dec-.*use-local$/);
      const ctx = await bus.getContext(decId, 'decision');
      expect(ctx.status).toBe('accepted');
      expect(ctx.decision).toBe('Store everything on local FS');
    });
  });

  describe('onHandoff', () => {
    it('writes handoff record', async () => {
      const hoId = await onHandoff(bus, {
        projectId: 'test',
      }, {
        from: 'sm',
        to: 'dev',
        summary: 'Story ready for implementation',
        reason: 'Sprint planning complete',
        completed: ['story_draft'],
        pending: ['implementation', 'tests'],
      });

      expect(hoId).toMatch(/^ho-.*sm-to-dev$/);
      const ctx = await bus.getContext(hoId, 'handoff');
      expect(ctx.from_agent).toBe('sm');
      expect(ctx.to_agent).toBe('dev');
      expect(ctx.state_snapshot.pending).toContain('implementation');
    });
  });
});
