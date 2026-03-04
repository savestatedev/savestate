import { describe, expect, it } from 'vitest';
import {
  AgentIdentitySchema,
  validateIdentity,
  safeValidateIdentity,
  createIdentity,
  getJsonSchema,
  IDENTITY_SCHEMA_VERSION,
  CORE_IDENTITY_FIELDS,
} from '../schema.js';

describe('AgentIdentitySchema', () => {
  describe('validateIdentity', () => {
    it('validates a minimal identity', () => {
      const identity = validateIdentity({ name: 'Test Agent' });
      expect(identity.name).toBe('Test Agent');
      expect(identity.version).toBe('1.0.0');
      expect(identity.goals).toEqual([]);
      expect(identity.constraints).toEqual([]);
      expect(identity.tools).toEqual([]);
      expect(identity.metadata).toEqual({});
    });

    it('validates a full identity', () => {
      const identity = validateIdentity({
        name: 'Assistant',
        version: '2.0.0',
        goals: ['Help users', 'Be accurate'],
        tone: 'professional',
        constraints: ['Never lie', 'Be helpful'],
        persona: 'A helpful AI assistant',
        instructions: 'Always be concise and clear.',
        metadata: { customField: 'value' },
      });

      expect(identity.name).toBe('Assistant');
      expect(identity.version).toBe('2.0.0');
      expect(identity.goals).toHaveLength(2);
      expect(identity.tone).toBe('professional');
      expect(identity.constraints).toHaveLength(2);
      expect(identity.persona).toBe('A helpful AI assistant');
      expect(identity.instructions).toBe('Always be concise and clear.');
      expect(identity.metadata).toEqual({ customField: 'value' });
    });

    it('validates identity with tools array', () => {
      // Test tools separately to isolate potential Zod issues
      const identity = validateIdentity({
        name: 'ToolTest',
        tools: [
          { name: 'calculator' },
        ],
      });

      expect(identity.name).toBe('ToolTest');
      expect(identity.tools).toHaveLength(1);
      expect(identity.tools[0].name).toBe('calculator');
    });

    it('throws on missing required field', () => {
      expect(() => validateIdentity({})).toThrow();
    });

    it('throws on invalid field type', () => {
      expect(() => validateIdentity({ name: 123 })).toThrow();
    });
  });

  describe('safeValidateIdentity', () => {
    it('returns success for valid identity', () => {
      const result = safeValidateIdentity({ name: 'Test' });
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Test');
    });

    it('returns error for invalid identity', () => {
      const result = safeValidateIdentity({ invalid: 'data' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createIdentity', () => {
    it('creates a valid identity with defaults', () => {
      const identity = createIdentity('New Agent');
      expect(identity.name).toBe('New Agent');
      expect(identity.schemaVersion).toBe(IDENTITY_SCHEMA_VERSION);
      expect(identity.version).toBe('1.0.0');
      expect(identity.createdAt).toBeDefined();
      expect(identity.updatedAt).toBeDefined();
    });

    it('creates identity with overrides', () => {
      const identity = createIdentity('Custom Agent', {
        tone: 'friendly',
        goals: ['Be helpful'],
      });
      expect(identity.name).toBe('Custom Agent');
      expect(identity.tone).toBe('friendly');
      expect(identity.goals).toEqual(['Be helpful']);
    });
  });

  describe('getJsonSchema', () => {
    it('returns a valid JSON Schema', () => {
      const schema = getJsonSchema();
      expect(schema).toHaveProperty('$schema');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
    });
  });

  describe('CORE_IDENTITY_FIELDS', () => {
    it('contains expected fields', () => {
      expect(CORE_IDENTITY_FIELDS).toContain('name');
      expect(CORE_IDENTITY_FIELDS).toContain('goals');
      expect(CORE_IDENTITY_FIELDS).toContain('constraints');
      expect(CORE_IDENTITY_FIELDS).toContain('tools');
    });
  });
});
