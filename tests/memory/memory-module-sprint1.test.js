'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { MemoryProvider, MEMORY_TYPES, METHODS } = require('../../.aiox-core/memory/providers/provider-interface');
const { FrontmatterSerializer } = require('../../.aiox-core/memory/serializers/frontmatter');
const { ContextPacker } = require('../../.aiox-core/memory/serializers/context-packer');
const LocalProvider = require('../../.aiox-core/memory/providers/local-provider');
const MemoryBus = require('../../.aiox-core/memory/memory-bus');

// ─── Helpers ────────────────────────────────────────────

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-memory-test-'));
}

function writeMd(dir, filename, frontmatter, body = '') {
  const serializer = new FrontmatterSerializer();
  const content = serializer.serialize(frontmatter, body);
  const filePath = path.join(dir, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// ─── MemoryProvider (abstract) ──────────────────────────

describe('MemoryProvider (abstract)', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new MemoryProvider('test')).toThrow('abstract');
  });

  it('exports MEMORY_TYPES and METHODS', () => {
    expect(MEMORY_TYPES).toContain('agent');
    expect(MEMORY_TYPES).toContain('session');
    expect(MEMORY_TYPES).toContain('decision');
    expect(METHODS).toContain('list');
    expect(METHODS).toContain('write');
    expect(METHODS).toContain('healthCheck');
  });
});

// ─── FrontmatterSerializer ──────────────────────────────

describe('FrontmatterSerializer', () => {
  const s = new FrontmatterSerializer();

  it('parses frontmatter + body from markdown', () => {
    const md = '---\ntype: session\nid: sess-001\nsummary: "Test session"\n---\n\n# Body here';
    const result = s.parse(md);
    expect(result.frontmatter.type).toBe('session');
    expect(result.frontmatter.id).toBe('sess-001');
    expect(result.frontmatter.summary).toBe('Test session');
    expect(result.body).toContain('Body here');
  });

  it('handles missing frontmatter', () => {
    const result = s.parse('Just body text');
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('Just body text');
  });

  it('handles null/empty input', () => {
    expect(s.parse(null).frontmatter).toEqual({});
    expect(s.parse('').frontmatter).toEqual({});
  });

  it('serializes frontmatter + body into markdown', () => {
    const fm = { type: 'decision', id: 'dec-001', status: 'accepted' };
    const body = '## Context\n\nSome details.';
    const result = s.serialize(fm, body);
    expect(result).toMatch(/^---\n/);
    expect(result).toContain('type: decision');
    expect(result).toContain('id: dec-001');
    expect(result).toContain('---\n\n## Context');
  });

  it('does roundtrip without data loss', () => {
    const original = {
      type: 'session',
      id: 'sess-test',
      summary: 'A test session',
      status: 'active',
      actions: ['action1', 'action2'],
      duration_minutes: 45,
    };
    const body = '## Notes\n\nSome notes here.';

    const serialized = s.serialize(original, body);
    const parsed = s.parse(serialized);

    expect(parsed.frontmatter.type).toBe(original.type);
    expect(parsed.frontmatter.id).toBe(original.id);
    expect(parsed.frontmatter.summary).toBe(original.summary);
    expect(parsed.frontmatter.duration_minutes).toBe(45);
    expect(parsed.frontmatter.actions).toEqual(['action1', 'action2']);
    expect(parsed.body).toContain('Some notes here.');
  });

  it('handles inline arrays', () => {
    const md = '---\ntags: [session, backend, test]\n---\n';
    const result = s.parse(md);
    expect(result.frontmatter.tags).toEqual(['session', 'backend', 'test']);
  });

  it('handles booleans and null', () => {
    const md = '---\nactive: true\narchived: false\ndeleted: null\n---\n';
    const result = s.parse(md);
    expect(result.frontmatter.active).toBe(true);
    expect(result.frontmatter.archived).toBe(false);
    expect(result.frontmatter.deleted).toBeNull();
  });

  it('extracts L0 summary', () => {
    const fm = { id: 'test-1', type: 'agent', summary: 'Test agent', status: 'active', updated: '2026-03-18' };
    const l0 = s.toL0(fm);
    expect(l0).toEqual({ id: 'test-1', type: 'agent', summary: 'Test agent', status: 'active', updated: '2026-03-18' });
  });
});

// ─── ContextPacker ──────────────────────────────────────

describe('ContextPacker', () => {
  it('estimates tokens from data', () => {
    const tokens = ContextPacker.estimateTokens('hello world');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(11 / 4));
  });

  it('packs data within budget', () => {
    const data = {
      project: { name: 'test', current_focus: 'testing' },
      recent_work: [
        { date: '2026-01', summary: 'a' },
        { date: '2026-02', summary: 'b' },
        { date: '2026-03', summary: 'c' },
        { date: '2026-04', summary: 'd' },
      ],
      recent_decisions: [],
      _meta: { loaded_at: 'now' },
    };
    const result = ContextPacker.pack(data, 'session_start');
    expect(result.withinBudget).toBe(true);
    expect(result.tokenCount).toBeLessThanOrEqual(1500);
  });

  it('strips _meta first when over budget', () => {
    const data = {
      _meta: { big_field: 'x'.repeat(200) },
      project: { name: 'test' },
    };
    const result = ContextPacker.pack(data, 50);
    expect(result.data._meta).toBeUndefined();
  });

  it('accepts numeric budget', () => {
    const result = ContextPacker.pack({ a: 1 }, 1000);
    expect(result.withinBudget).toBe(true);
  });
});

// ─── LocalProvider ──────────────────────────────────────

describe('LocalProvider', () => {
  let tmpDir;
  let provider;

  beforeEach(async () => {
    tmpDir = createTempDir();
    provider = new LocalProvider();
    await provider.initialize({ base_path: tmpDir });
  });

  afterEach(async () => {
    await provider.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('write + read cycle', () => {
    it('writes and reads a session item', async () => {
      await provider.write('sess-2026-03-18', {
        type: 'session',
        frontmatter: {
          summary: 'Test session',
          date: '2026-03-18',
          actions: ['action1'],
        },
      });

      const context = await provider.getContext('sess-2026-03-18');
      expect(context.type).toBe('session');
      expect(context.id).toBe('sess-2026-03-18');
      expect(context.summary).toBe('Test session');
    });

    it('writes and reads a decision with body', async () => {
      await provider.write('dec-2026-03-18-test', {
        type: 'decision',
        frontmatter: {
          summary: 'Test decision',
          decision: 'Use local provider',
          status: 'accepted',
        },
        body: '## Rationale\n\nBecause it works.',
      });

      const full = await provider.getFull('dec-2026-03-18-test');
      expect(full.frontmatter.decision).toBe('Use local provider');
      expect(full.body).toContain('Because it works.');
    });
  });

  describe('list', () => {
    it('lists items of a type', async () => {
      await provider.write('sess-001', { type: 'session', frontmatter: { summary: 'First' } });
      await provider.write('sess-002', { type: 'session', frontmatter: { summary: 'Second' } });

      const items = await provider.list('session');
      expect(items.length).toBe(2);
      expect(items.every(i => i.type === 'session')).toBe(true);
    });

    it('returns empty array for nonexistent type dir', async () => {
      const items = await provider.list('pipeline');
      // Pipeline dir was created by _ensureDirectories but is empty
      expect(items).toEqual([]);
    });

    it('filters by status', async () => {
      await provider.write('dec-a', { type: 'decision', frontmatter: { summary: 'A', status: 'accepted' } });
      await provider.write('dec-b', { type: 'decision', frontmatter: { summary: 'B', status: 'proposed' } });

      const accepted = await provider.list('decision', { status: 'accepted' });
      expect(accepted.length).toBe(1);
      expect(accepted[0].status).toBe('accepted');
    });
  });

  describe('patch', () => {
    it('updates only specified fields', async () => {
      await provider.write('sess-patch', {
        type: 'session',
        frontmatter: { summary: 'Original', status: 'active' },
        body: 'Keep this body.',
      });

      await provider.patch('sess-patch', { status: 'completed' });

      const full = await provider.getFull('sess-patch');
      expect(full.frontmatter.status).toBe('completed');
      expect(full.frontmatter.summary).toBe('Original');
      expect(full.body).toContain('Keep this body.');
    });
  });

  describe('remove', () => {
    it('archives by default', async () => {
      await provider.write('sess-remove', { type: 'session', frontmatter: { summary: 'To remove' } });
      await provider.remove('sess-remove');

      await expect(provider.getContext('sess-remove')).rejects.toThrow('not found');

      // Check archive directory exists
      const archiveDir = path.join(tmpDir, '.aiox-core', 'memory', 'data', 'sessions', '_archive');
      expect(fs.existsSync(archiveDir)).toBe(true);
    });

    it('deletes permanently when archive=false', async () => {
      await provider.write('sess-delete', { type: 'session', frontmatter: { summary: 'To delete' } });
      await provider.remove('sess-delete', false);

      await expect(provider.getContext('sess-delete')).rejects.toThrow('not found');
    });
  });

  describe('search', () => {
    it('finds items by content match', async () => {
      await provider.write('dec-billing', {
        type: 'decision',
        frontmatter: { summary: 'Billing per message' },
        body: 'Decided to charge per WhatsApp message sent.',
      });
      await provider.write('dec-infra', {
        type: 'decision',
        frontmatter: { summary: 'Isolated infra' },
        body: 'Each tenant gets their own container.',
      });

      const results = await provider.search('WhatsApp');
      expect(results.length).toBe(1);
      expect(results[0].id).toContain('billing');
    });
  });

  describe('recent', () => {
    it('returns items sorted by date descending', async () => {
      await provider.write('sess-old', {
        type: 'session',
        frontmatter: { summary: 'Old', date: '2026-01-01' },
      });
      await provider.write('sess-new', {
        type: 'session',
        frontmatter: { summary: 'New', date: '2026-03-18' },
      });

      const recent = await provider.recent('session', { limit: 2 });
      expect(recent.length).toBe(2);
      expect(recent[0].summary).toBe('New');
      expect(recent[1].summary).toBe('Old');
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when base path exists', async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.provider).toBe('local');
    });
  });
});

// ─── MemoryBus ──────────────────────────────────────────

describe('MemoryBus', () => {
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

  it('initializes with local provider', () => {
    expect(bus.providers.local).toBeDefined();
    expect(bus._initialized).toBe(true);
  });

  it('rejects operations before initialization', async () => {
    const uninit = new MemoryBus();
    await expect(uninit.list('session')).rejects.toThrow('Not initialized');
  });

  it('routes write/read through the bus', async () => {
    await bus.write('sess-bus-test', {
      type: 'session',
      frontmatter: { summary: 'Bus test' },
    });

    const ctx = await bus.getContext('sess-bus-test', 'session');
    expect(ctx.summary).toBe('Bus test');
  });

  it('infers type from ID prefix', async () => {
    await bus.write('dec-bus-test', {
      type: 'decision',
      frontmatter: { summary: 'Bus decision', decision: 'yes', status: 'accepted' },
    });

    // getContext without explicit type — should infer from "dec-" prefix
    const ctx = await bus.getContext('dec-bus-test');
    expect(ctx.summary).toBe('Bus decision');
  });

  it('supports search across types', async () => {
    await bus.write('dec-search-test', {
      type: 'decision',
      frontmatter: { summary: 'Contains keyword foobar' },
    });

    const results = await bus.search('foobar');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].summary).toContain('foobar');
  });

  it('healthCheck returns overall status', async () => {
    const health = await bus.healthCheck();
    expect(health.mode).toBe('local');
    expect(health.healthy).toBe(true);
    expect(health.providers.local.healthy).toBe(true);
  });

  it('close shuts down all providers', async () => {
    await bus.close();
    expect(bus._initialized).toBe(false);
    expect(Object.keys(bus.providers)).toHaveLength(0);
  });
});
