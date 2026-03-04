/**
 * SemanticDiff Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  diffIdentity, 
  diffObjects, 
  formatDiff, 
  validateIdentity,
  getIdentitySchema,
  ChangeType,
  AgentIdentity 
} from '../index.js';

describe('SemanticDiff', () => {
  describe('diffIdentity', () => {
    it('should detect no changes', () => {
      const identity: AgentIdentity = {
        name: 'TestBot',
        goals: ['Help users'],
      };
      
      const result = diffIdentity(identity, identity);
      
      expect(result.hasChanges).toBe(false);
      expect(result.summary).toBe('No changes detected');
    });

    it('should detect added fields', () => {
      const oldId: AgentIdentity = {
        name: 'TestBot',
      };
      
      const newId: AgentIdentity = {
        name: 'TestBot',
        goals: ['Help users'],
        tone: 'friendly',
      };
      
      const result = diffIdentity(oldId, newId);
      
      expect(result.hasChanges).toBe(true);
      expect(result.addedCount).toBe(2);
      expect(result.changes.some(c => c.path === 'goals')).toBe(true);
      expect(result.changes.some(c => c.path === 'tone')).toBe(true);
    });

    it('should detect removed fields', () => {
      const oldId: AgentIdentity = {
        name: 'TestBot',
        goals: ['Help users'],
        tone: 'friendly',
      };
      
      const newId: AgentIdentity = {
        name: 'TestBot',
      };
      
      const result = diffIdentity(oldId, newId);
      
      expect(result.hasChanges).toBe(true);
      expect(result.removedCount).toBe(2);
    });

    it('should detect modified fields', () => {
      const oldId: AgentIdentity = {
        name: 'TestBot',
        tone: 'formal',
      };
      
      const newId: AgentIdentity = {
        name: 'TestBot',
        tone: 'casual',
      };
      
      const result = diffIdentity(oldId, newId);
      
      expect(result.hasChanges).toBe(true);
      expect(result.modifiedCount).toBe(1);
      expect(result.changes[0].type).toBe(ChangeType.MODIFIED);
      expect(result.changes[0].oldValue).toBe('formal');
      expect(result.changes[0].newValue).toBe('casual');
    });

    it('should detect changes in arrays', () => {
      const oldId: AgentIdentity = {
        name: 'TestBot',
        goals: ['Goal 1', 'Goal 2'],
      };
      
      const newId: AgentIdentity = {
        name: 'TestBot',
        goals: ['Goal 1', 'Goal 3'],
      };
      
      const result = diffIdentity(oldId, newId);
      
      expect(result.hasChanges).toBe(true);
    });

    it('should detect nested changes', () => {
      const oldId: AgentIdentity = {
        name: 'TestBot',
        memory: {
          maxMemories: 100,
          importanceThreshold: 0.5,
        },
      };
      
      const newId: AgentIdentity = {
        name: 'TestBot',
        memory: {
          maxMemories: 200,
          importanceThreshold: 0.5,
        },
      };
      
      const result = diffIdentity(oldId, newId);
      
      expect(result.hasChanges).toBe(true);
      expect(result.changes.some(c => c.path === 'memory.maxMemories')).toBe(true);
    });
  });

  describe('diffObjects', () => {
    it('should work with generic objects', () => {
      const oldObj = { a: 1, b: 2 };
      const newObj = { a: 1, b: 3, c: 4 };
      
      const result = diffObjects(oldObj, newObj);
      
      expect(result.hasChanges).toBe(true);
      expect(result.modifiedCount).toBe(1);
      expect(result.addedCount).toBe(1);
    });
  });

  describe('formatDiff', () => {
    it('should format diff with no changes', () => {
      const identity: AgentIdentity = { name: 'Bot' };
      const result = diffIdentity(identity, identity);
      const formatted = formatDiff(result);
      
      expect(formatted).toContain('No changes detected');
    });

    it('should format added changes', () => {
      const oldId: AgentIdentity = { name: 'Bot' };
      const newId: AgentIdentity = { name: 'Bot', goals: ['New goal'] };
      
      const result = diffIdentity(oldId, newId);
      const formatted = formatDiff(result);
      
      expect(formatted).toContain('Added:');
      expect(formatted).toContain('goals');
    });

    it('should format removed changes', () => {
      const oldId: AgentIdentity = { name: 'Bot', goals: ['Old goal'] };
      const newId: AgentIdentity = { name: 'Bot' };
      
      const result = diffIdentity(oldId, newId);
      const formatted = formatDiff(result);
      
      expect(formatted).toContain('Removed:');
    });

    it('should format modified changes', () => {
      const oldId: AgentIdentity = { name: 'Bot', tone: 'formal' };
      const newId: AgentIdentity = { name: 'Bot', tone: 'casual' };
      
      const result = diffIdentity(oldId, newId);
      const formatted = formatDiff(result);
      
      expect(formatted).toContain('Modified:');
      expect(formatted).toContain('formal');
      expect(formatted).toContain('casual');
    });
  });

  describe('validateIdentity', () => {
    it('should validate valid identity', () => {
      const identity = {
        name: 'TestBot',
        goals: ['Help'],
      };
      
      const result = validateIdentity(identity);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject identity without name', () => {
      const identity = {
        goals: ['Help'],
      };
      
      const result = validateIdentity(identity);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required and must be a string');
    });

    it('should reject invalid types', () => {
      const identity = {
        name: 'TestBot',
        goals: 'not an array',
      };
      
      const result = validateIdentity(identity);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('goals must be an array');
    });
  });

  describe('getIdentitySchema', () => {
    it('should return valid JSON Schema', () => {
      const schema = getIdentitySchema();
      
      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('name');
    });
  });
});
