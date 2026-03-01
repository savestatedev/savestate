/**
 * State Events Tests
 *
 * Issue #91: Schema-aware, metadata-tagged state capture
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StateEventStore,
  STATE_EVENTS_FILE,
} from '../store.js';
import {
  parseTagString,
  parseMetaString,
  STATE_EVENTS_VERSION,
  type StateEvent,
  type StateEventType,
} from '../types.js';
import {
  getGlobalStore,
  setGlobalStore,
  clearGlobalStore,
  recordStateEvent,
  queryStateEvents,
  getStateEventsByType,
  getStateEventsByKey,
  getLatestStateValue,
  getDecisions,
  getPreferences,
  getErrors,
  getApiResponses,
  recordDecision,
  recordPreference,
  recordError,
  recordApiResponse,
  exportStateEvents,
} from '../helpers.js';

describe('StateEventStore', () => {
  let store: StateEventStore;

  beforeEach(() => {
    store = new StateEventStore();
  });

  describe('add', () => {
    it('should add a state event and return it with generated id and timestamp', () => {
      const event = store.add({
        type: 'decision',
        key: 'api_provider',
        value: 'openai',
        tags: ['architecture'],
        metadata: { confidence: 'high' },
      });

      expect(event.id).toBeDefined();
      expect(event.type).toBe('decision');
      expect(event.key).toBe('api_provider');
      expect(event.value).toBe('openai');
      expect(event.tags).toEqual(['architecture']);
      expect(event.metadata).toEqual({ confidence: 'high' });
      expect(event.timestamp).toBeDefined();
    });

    it('should use empty arrays/objects for optional fields', () => {
      const event = store.add({
        type: 'preference',
        key: 'theme',
        value: 'dark',
      });

      expect(event.tags).toEqual([]);
      expect(event.metadata).toEqual({});
    });
  });

  describe('get', () => {
    it('should retrieve an event by ID', () => {
      const event = store.add({
        type: 'error',
        key: 'auth_failure',
        value: { code: 401 },
      });

      const retrieved = store.get(event.id);
      expect(retrieved).toEqual(event);
    });

    it('should return null for non-existent ID', () => {
      expect(store.get('non-existent-id')).toBeNull();
    });
  });

  describe('query', () => {
    beforeEach(() => {
      store.add({ type: 'decision', key: 'api', value: 'openai', tags: ['arch'] });
      store.add({ type: 'decision', key: 'database', value: 'postgres', tags: ['arch', 'data'] });
      store.add({ type: 'preference', key: 'theme', value: 'dark' });
      store.add({ type: 'error', key: 'timeout', value: { ms: 5000 } });
    });

    it('should return all events when no filter provided', () => {
      const results = store.query();
      expect(results).toHaveLength(4);
    });

    it('should filter by type', () => {
      const decisions = store.query({ type: 'decision' });
      expect(decisions).toHaveLength(2);
      expect(decisions.every(e => e.type === 'decision')).toBe(true);
    });

    it('should filter by exact key', () => {
      const results = store.query({ key: 'theme' });
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('theme');
    });

    it('should filter by key prefix', () => {
      store.add({ type: 'custom', key: 'user.name', value: 'Alice' });
      store.add({ type: 'custom', key: 'user.email', value: 'alice@test.com' });

      const results = store.query({ keyPrefix: 'user.' });
      expect(results).toHaveLength(2);
    });

    it('should filter by tags (ALL must match)', () => {
      const results = store.query({ tags: ['arch', 'data'] });
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('database');
    });

    it('should filter by tags (ANY must match)', () => {
      const results = store.query({ tagsAny: ['arch'] });
      expect(results).toHaveLength(2);
    });

    it('should respect limit', () => {
      const results = store.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should respect offset', () => {
      const all = store.query();
      const offset = store.query({ offset: 2 });
      expect(offset).toHaveLength(all.length - 2);
    });
  });

  describe('getByType', () => {
    it('should return all events of a specific type', () => {
      store.add({ type: 'decision', key: 'a', value: 1 });
      store.add({ type: 'preference', key: 'b', value: 2 });
      store.add({ type: 'decision', key: 'c', value: 3 });

      const decisions = store.getByType('decision');
      expect(decisions).toHaveLength(2);
    });
  });

  describe('getByKey', () => {
    it('should return all events with a specific key', () => {
      store.add({ type: 'decision', key: 'theme', value: 'light' });
      store.add({ type: 'preference', key: 'theme', value: 'dark' });

      const themeEvents = store.getByKey('theme');
      expect(themeEvents).toHaveLength(2);
    });
  });

  describe('getLatestByKey', () => {
    it('should return the most recent event for a key', async () => {
      store.add({ type: 'preference', key: 'theme', value: 'light' });
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      store.add({ type: 'preference', key: 'theme', value: 'dark' });

      const latest = store.getLatestByKey('theme');
      expect(latest?.value).toBe('dark');
    });

    it('should return null for non-existent key', () => {
      expect(store.getLatestByKey('non-existent')).toBeNull();
    });
  });

  describe('JSONL serialization', () => {
    it('should serialize to JSONL format', () => {
      store.add({ type: 'decision', key: 'a', value: 1 });
      store.add({ type: 'preference', key: 'b', value: 'test' });

      const jsonl = store.toJSONL();
      const lines = jsonl.trim().split('\n');

      expect(lines).toHaveLength(2);
      expect(() => JSON.parse(lines[0])).not.toThrow();
      expect(() => JSON.parse(lines[1])).not.toThrow();
    });

    it('should load from JSONL format', () => {
      const event1: StateEvent = {
        id: 'test-1',
        type: 'decision',
        timestamp: '2024-01-01T00:00:00Z',
        key: 'api',
        value: 'openai',
        tags: [],
        metadata: {},
      };
      const event2: StateEvent = {
        id: 'test-2',
        type: 'preference',
        timestamp: '2024-01-01T00:00:01Z',
        key: 'theme',
        value: 'dark',
        tags: [],
        metadata: {},
      };

      const jsonl = `${JSON.stringify(event1)}\n${JSON.stringify(event2)}\n`;
      store.fromJSONL(jsonl);

      expect(store.count()).toBe(2);
      expect(store.get('test-1')).toEqual(event1);
      expect(store.get('test-2')).toEqual(event2);
    });

    it('should survive round-trip serialization', () => {
      store.add({ type: 'decision', key: 'api', value: 'openai', tags: ['arch'] });
      store.add({ type: 'preference', key: 'theme', value: 'dark' });

      const jsonl = store.toJSONL();
      const newStore = StateEventStore.fromJSONL(jsonl);

      expect(newStore.count()).toBe(2);
      expect(newStore.getByType('decision')).toHaveLength(1);
      expect(newStore.getByType('preference')).toHaveLength(1);
    });

    it('should skip invalid JSONL lines', () => {
      const jsonl = `{"id":"1","type":"decision","timestamp":"2024","key":"a","value":1,"tags":[],"metadata":{}}
not valid json
{"id":"2","type":"preference","timestamp":"2024","key":"b","value":2,"tags":[],"metadata":{}}`;

      store.fromJSONL(jsonl);
      expect(store.count()).toBe(2);
    });
  });

  describe('merge', () => {
    it('should merge events from another store', () => {
      store.add({ type: 'decision', key: 'a', value: 1 });

      const other = new StateEventStore();
      other.add({ type: 'preference', key: 'b', value: 2 });

      store.merge(other);
      expect(store.count()).toBe(2);
    });
  });
});

describe('CLI parsing', () => {
  describe('parseTagString', () => {
    it('should parse valid tag strings', () => {
      const result = parseTagString('decision:api_provider=openai');
      expect(result).toEqual({
        type: 'decision',
        key: 'api_provider',
        value: 'openai',
        tags: [],
        metadata: {},
      });
    });

    it('should parse preference tags', () => {
      const result = parseTagString('preference:theme=dark');
      expect(result?.type).toBe('preference');
      expect(result?.key).toBe('theme');
      expect(result?.value).toBe('dark');
    });

    it('should parse error tags', () => {
      const result = parseTagString('error:auth_failure=401');
      expect(result?.type).toBe('error');
    });

    it('should parse api_response tags', () => {
      const result = parseTagString('api_response:weather=sunny');
      expect(result?.type).toBe('api_response');
    });

    it('should parse custom tags', () => {
      const result = parseTagString('custom:my_key=my_value');
      expect(result?.type).toBe('custom');
    });

    it('should return null for missing colon', () => {
      expect(parseTagString('decision')).toBeNull();
    });

    it('should return null for missing equals', () => {
      expect(parseTagString('decision:api_provider')).toBeNull();
    });

    it('should return null for invalid type', () => {
      expect(parseTagString('invalid:key=value')).toBeNull();
    });

    it('should handle values with equals signs', () => {
      const result = parseTagString('custom:equation=a=b+c');
      expect(result?.value).toBe('a=b+c');
    });
  });

  describe('parseMetaString', () => {
    it('should parse valid meta strings', () => {
      const result = parseMetaString('confidence=high');
      expect(result).toEqual({ key: 'confidence', value: 'high' });
    });

    it('should return null for missing equals', () => {
      expect(parseMetaString('confidence')).toBeNull();
    });

    it('should handle values with equals signs', () => {
      const result = parseMetaString('formula=x=y+z');
      expect(result?.value).toBe('x=y+z');
    });
  });
});

describe('Helper functions', () => {
  beforeEach(() => {
    clearGlobalStore();
  });

  describe('global store management', () => {
    it('should create global store on demand', () => {
      const store = getGlobalStore();
      expect(store).toBeInstanceOf(StateEventStore);
    });

    it('should clear global store', () => {
      recordStateEvent('decision', 'test', 'value');
      expect(exportStateEvents()).toHaveLength(1);

      clearGlobalStore();
      expect(getGlobalStore().count()).toBe(0);
    });

    it('should set custom global store', () => {
      const custom = new StateEventStore();
      custom.add({ type: 'decision', key: 'pre-existing', value: 'test' });

      setGlobalStore(custom);
      expect(getGlobalStore().count()).toBe(1);
    });
  });

  describe('recordStateEvent', () => {
    it('should record an event to global store', () => {
      const event = recordStateEvent('decision', 'api', 'openai', ['arch']);
      expect(event.type).toBe('decision');
      expect(event.key).toBe('api');
      expect(event.value).toBe('openai');
      expect(event.tags).toEqual(['arch']);
    });
  });

  describe('queryStateEvents', () => {
    it('should query global store', () => {
      recordStateEvent('decision', 'a', 1);
      recordStateEvent('preference', 'b', 2);

      const decisions = queryStateEvents({ type: 'decision' });
      expect(decisions).toHaveLength(1);
    });
  });

  describe('type-specific getters', () => {
    beforeEach(() => {
      recordStateEvent('decision', 'd1', 'v1');
      recordStateEvent('preference', 'p1', 'v2');
      recordStateEvent('error', 'e1', 'v3');
      recordStateEvent('api_response', 'a1', 'v4');
    });

    it('should get decisions', () => {
      expect(getDecisions()).toHaveLength(1);
      expect(getDecisions()[0].type).toBe('decision');
    });

    it('should get preferences', () => {
      expect(getPreferences()).toHaveLength(1);
      expect(getPreferences()[0].type).toBe('preference');
    });

    it('should get errors', () => {
      expect(getErrors()).toHaveLength(1);
      expect(getErrors()[0].type).toBe('error');
    });

    it('should get API responses', () => {
      expect(getApiResponses()).toHaveLength(1);
      expect(getApiResponses()[0].type).toBe('api_response');
    });
  });

  describe('getLatestStateValue', () => {
    it('should get latest value for a key', async () => {
      recordStateEvent('preference', 'theme', 'light');
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5));
      recordStateEvent('preference', 'theme', 'dark');

      expect(getLatestStateValue('theme')).toBe('dark');
    });

    it('should return undefined for non-existent key', () => {
      expect(getLatestStateValue('non-existent')).toBeUndefined();
    });
  });

  describe('convenience recorders', () => {
    it('should record decision with metadata', () => {
      const event = recordDecision('database', 'postgres', 'Best performance', ['mysql', 'sqlite']);
      expect(event.type).toBe('decision');
      expect(event.metadata.reason).toBe('Best performance');
      expect(event.metadata.alternatives).toEqual(['mysql', 'sqlite']);
    });

    it('should record preference with source', () => {
      const event = recordPreference('theme', 'dark', 'user-settings');
      expect(event.type).toBe('preference');
      expect(event.metadata.source).toBe('user-settings');
    });

    it('should record error with context', () => {
      const error = new Error('Connection failed');
      const event = recordError('db_connection', error, { attempt: 3 });

      expect(event.type).toBe('error');
      expect(event.value).toMatchObject({
        name: 'Error',
        message: 'Connection failed',
      });
      expect(event.metadata.attempt).toBe(3);
    });

    it('should record API response with context', () => {
      const event = recordApiResponse('weather', { temp: 72 }, { endpoint: '/api/weather' });
      expect(event.type).toBe('api_response');
      expect(event.value).toEqual({ temp: 72 });
      expect(event.metadata.endpoint).toBe('/api/weather');
    });
  });
});

describe('Constants', () => {
  it('should export STATE_EVENTS_FILE', () => {
    expect(STATE_EVENTS_FILE).toBe('state-events.jsonl');
  });

  it('should export STATE_EVENTS_VERSION', () => {
    expect(STATE_EVENTS_VERSION).toBe('1.0.0');
  });
});
