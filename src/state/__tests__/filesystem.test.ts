/**
 * State Filesystem Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StateFilesystem,
  InMemoryStateStorage,
  detectValueType,
  validatePath,
  parsePath,
  matchesPrefix,
  PathBuilder,
} from '../index.js';

describe('StateFilesystem', () => {
  let storage: InMemoryStateStorage;
  let fs: StateFilesystem;

  beforeEach(() => {
    storage = new InMemoryStateStorage();
    fs = new StateFilesystem(storage);
  });

  describe('write', () => {
    it('should write a value to a path', async () => {
      const result = await fs.write({
        path: '/user/123/preferences/theme',
        value: 'dark',
        writer: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe(1);
      expect(result.path).toBe('/user/123/preferences/theme');
    });

    it('should increment version on update', async () => {
      await fs.write({
        path: '/test/key',
        value: 'v1',
        writer: 'system',
      });

      const result = await fs.write({
        path: '/test/key',
        value: 'v2',
        writer: 'system',
      });

      expect(result.version).toBe(2);
    });

    it('should fail with invalid path', async () => {
      const result = await fs.write({
        path: 'no-leading-slash',
        value: 'test',
        writer: 'system',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must start with /');
    });

    it('should support optimistic locking', async () => {
      await fs.write({
        path: '/test/lock',
        value: 'v1',
        writer: 'agent-1',
      });

      // Should fail with wrong version
      const result = await fs.write({
        path: '/test/lock',
        value: 'v2',
        writer: 'agent-2',
        expected_version: 999,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version mismatch');
    });

    it('should detect value types', async () => {
      await fs.write({ path: '/string', value: 'hello', writer: 's' });
      await fs.write({ path: '/number', value: 42, writer: 's' });
      await fs.write({ path: '/bool', value: true, writer: 's' });
      await fs.write({ path: '/json', value: { key: 'value' }, writer: 's' });

      const string = await fs.get('/string');
      const number = await fs.get('/number');
      const bool = await fs.get('/bool');
      const json = await fs.get('/json');

      expect(string?.type).toBe('string');
      expect(number?.type).toBe('number');
      expect(bool?.type).toBe('boolean');
      expect(json?.type).toBe('json');
    });
  });

  describe('get', () => {
    it('should retrieve a value by path', async () => {
      await fs.write({
        path: '/test/get',
        value: { foo: 'bar' },
        writer: 'test',
        description: 'Test object',
      });

      const state = await fs.get('/test/get');

      expect(state).not.toBeNull();
      expect(state?.value).toEqual({ foo: 'bar' });
      expect(state?.description).toBe('Test object');
    });

    it('should return null for non-existent path', async () => {
      const state = await fs.get('/does/not/exist');
      expect(state).toBeNull();
    });

    it('should respect TTL configuration', async () => {
      // Write with a TTL
      await fs.write({
        path: '/test/ttl',
        value: 'temporary',
        writer: 'test',
        ttl: 3600, // 1 hour TTL
      });

      // Verify it exists (TTL not expired)
      const state = await fs.get('/test/ttl');
      expect(state).not.toBeNull();
      expect(state?.ttl).toBe(3600);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await fs.write({ path: '/user/1/name', value: 'Alice', writer: 's' });
      await fs.write({ path: '/user/1/email', value: 'alice@test.com', writer: 's' });
      await fs.write({ path: '/user/2/name', value: 'Bob', writer: 's' });
      await fs.write({ path: '/project/1/title', value: 'Project A', writer: 's' });
    });

    it('should list paths by prefix', async () => {
      const items = await fs.list('/user/1');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.path)).toContain('/user/1/name');
      expect(items.map(i => i.path)).toContain('/user/1/email');
    });

    it('should list all paths with root prefix', async () => {
      const items = await fs.list('/');

      expect(items).toHaveLength(4);
    });

    it('should respect limit', async () => {
      const items = await fs.list('/', { limit: 2 });

      expect(items).toHaveLength(2);
    });

    it('should include values when requested', async () => {
      const items = await fs.list('/user/1', { include_values: true });

      expect(items[0].value).toBeDefined();
    });

    it('should filter by tags', async () => {
      await fs.write({ 
        path: '/tagged/1', 
        value: 'test', 
        writer: 's', 
        tags: ['important', 'urgent'] 
      });
      await fs.write({ 
        path: '/tagged/2', 
        value: 'test', 
        writer: 's', 
        tags: ['important'] 
      });

      const items = await fs.list('/tagged', { tags: ['urgent'] });

      expect(items).toHaveLength(1);
      expect(items[0].path).toBe('/tagged/1');
    });

    it('should filter by confidence', async () => {
      await fs.write({ 
        path: '/conf/high', 
        value: 'test', 
        writer: 's', 
        confidence: 0.9 
      });
      await fs.write({ 
        path: '/conf/low', 
        value: 'test', 
        writer: 's', 
        confidence: 0.3 
      });

      const items = await fs.list('/conf', { min_confidence: 0.5 });

      expect(items).toHaveLength(1);
      expect(items[0].path).toBe('/conf/high');
    });
  });

  describe('history', () => {
    it('should return version history', async () => {
      await fs.write({ path: '/hist/test', value: 'v1', writer: 's' });
      await fs.write({ path: '/hist/test', value: 'v2', writer: 's' });
      await fs.write({ path: '/hist/test', value: 'v3', writer: 's' });

      const history = await fs.history('/hist/test');

      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(3); // Newest first
      expect(history[2].version).toBe(1);
    });

    it('should respect limit', async () => {
      await fs.write({ path: '/hist/limited', value: 'v1', writer: 's' });
      await fs.write({ path: '/hist/limited', value: 'v2', writer: 's' });
      await fs.write({ path: '/hist/limited', value: 'v3', writer: 's' });

      const history = await fs.history('/hist/limited', 2);

      expect(history).toHaveLength(2);
    });
  });

  describe('resolve', () => {
    beforeEach(async () => {
      await fs.write({
        path: '/user/1/preferences/theme',
        value: 'dark mode enabled',
        writer: 'user',
        confidence: 0.9,
        description: 'User theme preference',
      });
      await fs.write({
        path: '/project/1/decisions/2024-01-15',
        value: 'Decided to use TypeScript',
        writer: 'agent',
        confidence: 0.8,
        description: 'Project language decision',
      });
      await fs.write({
        path: '/agent/1/procedures/deploy',
        value: 'Run npm build then deploy to S3',
        writer: 'admin',
        confidence: 1.0,
        description: 'Deployment procedure',
      });
    });

    it('should find relevant paths for query', async () => {
      const results = await fs.resolve({
        query: 'dark mode theme',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].path).toContain('theme');
    });

    it('should include scores', async () => {
      const results = await fs.resolve({
        query: 'TypeScript',
      });

      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score_components).toBeDefined();
    });

    it('should filter by prefix', async () => {
      const results = await fs.resolve({
        query: 'deploy',
        prefix: '/agent',
      });

      expect(results.every(r => r.path.startsWith('/agent'))).toBe(true);
    });

    it('should filter by min_score', async () => {
      const results = await fs.resolve({
        query: 'completely irrelevant gibberish xyz123',
        min_score: 0.9,
      });

      expect(results).toHaveLength(0);
    });

    it('should include state when requested', async () => {
      const results = await fs.resolve({
        query: 'deploy',
        include_values: true,
      });

      expect(results[0].state).toBeDefined();
    });
  });

  describe('bundle', () => {
    beforeEach(async () => {
      await fs.write({
        path: '/ctx/1',
        value: 'First context item',
        writer: 's',
        confidence: 0.9,
        evidence_refs: ['ref-1'],
      });
      await fs.write({
        path: '/ctx/2',
        value: 'Second context item with longer content that takes more tokens',
        writer: 's',
        confidence: 0.8,
        evidence_refs: ['ref-2'],
      });
      await fs.write({
        path: '/ctx/3',
        value: 'Third context item',
        writer: 's',
        confidence: 0.7,
        evidence_refs: [],
      });
    });

    it('should bundle paths into context', async () => {
      const bundle = await fs.bundle({
        paths: ['/ctx/1', '/ctx/2'],
        token_budget: 1000,
        strategy: 'full',
      });

      expect(bundle.included_paths).toContain('/ctx/1');
      expect(bundle.included_paths).toContain('/ctx/2');
      expect(bundle.context).toContain('First context');
      expect(bundle.context).toContain('Second context');
    });

    it('should respect token budget', async () => {
      const bundle = await fs.bundle({
        paths: ['/ctx/1', '/ctx/2', '/ctx/3'],
        token_budget: 20, // Very small budget
        strategy: 'full',
      });

      expect(bundle.excluded_paths.length).toBeGreaterThan(0);
      expect(bundle.token_count).toBeLessThanOrEqual(20);
    });

    it('should include citations', async () => {
      const bundle = await fs.bundle({
        paths: ['/ctx/1'],
        token_budget: 1000,
        strategy: 'full',
      });

      expect(bundle.citations).toHaveLength(1);
      expect(bundle.citations[0].path).toBe('/ctx/1');
      expect(bundle.citations[0].evidence_refs).toContain('ref-1');
    });

    it('should use summary strategy', async () => {
      const longValue = 'A'.repeat(200);
      await fs.write({
        path: '/ctx/long',
        value: longValue,
        writer: 's',
        confidence: 1,
        evidence_refs: [],
      });

      const bundle = await fs.bundle({
        paths: ['/ctx/long'],
        token_budget: 1000,
        strategy: 'summary',
      });

      expect(bundle.context.length).toBeLessThan(longValue.length + 100);
      expect(bundle.context).toContain('...');
    });

    it('should respect priorities', async () => {
      const bundle = await fs.bundle({
        paths: ['/ctx/1', '/ctx/2'],
        token_budget: 30, // Only room for one
        strategy: 'full',
        priorities: {
          '/ctx/2': 10, // Higher priority
          '/ctx/1': 1,
        },
      });

      expect(bundle.included_paths).toContain('/ctx/2');
      expect(bundle.excluded_paths).toContain('/ctx/1');
    });
  });

  describe('copy and move', () => {
    it('should copy state to new path', async () => {
      await fs.write({
        path: '/original',
        value: 'copy me',
        writer: 'test',
        tags: ['tag1'],
      });

      const result = await fs.copy('/original', '/copied', 'copier');

      expect(result.success).toBe(true);

      const copied = await fs.get('/copied');
      expect(copied?.value).toBe('copy me');
      expect(copied?.evidence_refs).toContain('/original');
    });

    it('should move state to new path', async () => {
      await fs.write({
        path: '/to-move',
        value: 'move me',
        writer: 'test',
      });

      await fs.move('/to-move', '/moved', 'mover');

      const original = await fs.get('/to-move');
      const moved = await fs.get('/moved');

      expect(original).toBeNull();
      expect(moved?.value).toBe('move me');
    });
  });
});

describe('Path Utilities', () => {
  describe('detectValueType', () => {
    it('should detect string', () => {
      expect(detectValueType('hello')).toBe('string');
    });

    it('should detect number', () => {
      expect(detectValueType(42)).toBe('number');
    });

    it('should detect boolean', () => {
      expect(detectValueType(true)).toBe('boolean');
    });

    it('should detect datetime', () => {
      expect(detectValueType('2024-01-15')).toBe('datetime');
      expect(detectValueType('2024-01-15T10:30:00')).toBe('datetime');
    });

    it('should detect code', () => {
      const code = `function hello() {
        console.log('world');
      }`;
      expect(detectValueType(code)).toBe('code');
    });

    it('should detect text for long strings', () => {
      const longText = 'a'.repeat(600);
      expect(detectValueType(longText)).toBe('text');
    });

    it('should detect json for objects', () => {
      expect(detectValueType({ key: 'value' })).toBe('json');
      expect(detectValueType([1, 2, 3])).toBe('json');
    });
  });

  describe('validatePath', () => {
    it('should accept valid paths', () => {
      expect(validatePath('/user/123/name').valid).toBe(true);
      expect(validatePath('/a/b/c').valid).toBe(true);
      expect(validatePath('/').valid).toBe(true);
    });

    it('should reject paths without leading slash', () => {
      expect(validatePath('no-slash').valid).toBe(false);
    });

    it('should reject paths with double slashes', () => {
      expect(validatePath('/a//b').valid).toBe(false);
    });

    it('should reject paths with trailing slash', () => {
      expect(validatePath('/a/b/').valid).toBe(false);
    });
  });

  describe('parsePath', () => {
    it('should parse path into segments', () => {
      expect(parsePath('/a/b/c')).toEqual(['a', 'b', 'c']);
      expect(parsePath('/user/123')).toEqual(['user', '123']);
      expect(parsePath('/')).toEqual([]);
    });
  });

  describe('matchesPrefix', () => {
    it('should match exact path', () => {
      expect(matchesPrefix('/a/b', '/a/b')).toBe(true);
    });

    it('should match child paths', () => {
      expect(matchesPrefix('/a/b/c', '/a/b')).toBe(true);
      expect(matchesPrefix('/a/b/c/d', '/a')).toBe(true);
    });

    it('should not match non-children', () => {
      expect(matchesPrefix('/a/bc', '/a/b')).toBe(false);
    });

    it('should match root prefix', () => {
      expect(matchesPrefix('/anything', '/')).toBe(true);
    });
  });

  describe('PathBuilder', () => {
    it('should build user preference path', () => {
      expect(PathBuilder.userPreference('123', 'theme'))
        .toBe('/user/123/preferences/theme');
    });

    it('should build project decision path', () => {
      expect(PathBuilder.projectDecision('proj-1', '2024-01-15'))
        .toBe('/project/proj-1/decisions/2024-01-15');
    });

    it('should build agent procedure path', () => {
      expect(PathBuilder.agentProcedure('agent-1', 'deploy'))
        .toBe('/agent/agent-1/procedures/deploy');
    });
  });
});
