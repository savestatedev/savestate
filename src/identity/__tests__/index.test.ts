/**
 * Identity Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  fromIdentity, 
  diff, 
  formatDiff,
  type AgentIdentity,
  type SemanticDiff 
} from '../index.js';
import type { Identity } from '../../types.js';

describe('Identity', () => {
  describe('fromIdentity', () => {
    it('should create identity from Identity object', () => {
      const identity: Identity = {
        personality: 'You are a helpful assistant designed to assist with coding tasks.',
        config: { theme: 'dark', maxTokens: 2000 },
        tools: [
          { name: 'bash', type: 'tool', config: {}, enabled: true },
        ],
        skills: [
          { name: 'coding', files: {} },
        ],
      };

      const agentIdentity = fromIdentity(identity, 'TestAgent');

      expect(agentIdentity.name).toBe('TestAgent');
      expect(agentIdentity.version).toBe('1.0.0');
      expect(agentIdentity.id).toMatch(/^id_/);
      expect(agentIdentity.goals).toBeDefined();
      expect(agentIdentity.capabilities.length).toBe(2); // 1 tool + 1 skill
      expect(agentIdentity.constraints).toBeDefined();
    });

    it('should handle empty identity', () => {
      const identity: Identity = {};

      const agentIdentity = fromIdentity(identity);

      expect(agentIdentity.name).toBe('Agent');
      expect(agentIdentity.goals).toEqual([]);
      expect(agentIdentity.capabilities).toEqual([]);
    });

    it('should extract tone from personality', () => {
      const identity: Identity = {
        personality: 'You are a friendly and casual assistant.',
      };

      const agentIdentity = fromIdentity(identity);

      expect(agentIdentity.tone).toBeDefined();
      expect(agentIdentity.tone?.style).toBe('friendly');
    });

    it('should handle technical personality', () => {
      const identity: Identity = {
        personality: 'You are a highly technical assistant specialized in system architecture and low-level programming.',
      };

      const agentIdentity = fromIdentity(identity);

      expect(agentIdentity.tone?.style).toBe('technical');
    });
  });

  describe('diff', () => {
    let fromIdentity: AgentIdentity;
    let toIdentity: AgentIdentity;

    beforeEach(() => {
      fromIdentity = {
        version: '1.0.0',
        id: 'test-id',
        name: 'TestAgent',
        goals: ['Help with coding', 'Answer questions'],
        constraints: [
          { type: 'safety', description: 'Never reveal secrets', enabled: true },
        ],
        capabilities: [
          { name: 'bash', type: 'tool', enabled: true },
        ],
        metadata: {
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      toIdentity = {
        ...fromIdentity,
        goals: ['Help with coding', 'Answer questions', 'New goal'],
        constraints: [
          { type: 'safety', description: 'Never reveal secrets', enabled: true },
          { type: 'policy', description: 'Always be polite', enabled: true },
        ],
        capabilities: [
          { name: 'bash', type: 'tool', enabled: true },
          { name: 'web-search', type: 'tool', enabled: true },
        ],
      };
    });

    it('should detect added goals', () => {
      const result = diff(fromIdentity, toIdentity);

      const addChanges = result.changes.filter(c => c.type === 'added');
      expect(addChanges.length).toBeGreaterThan(0);
    });

    it('should detect removed items', () => {
      const removedIdentity: AgentIdentity = {
        ...fromIdentity,
        goals: ['Help with coding'],
      };

      const result = diff(fromIdentity, removedIdentity);

      const removeChanges = result.changes.filter(c => c.type === 'removed');
      expect(removeChanges.length).toBeGreaterThan(0);
    });

    it('should detect modifications', () => {
      const modifiedIdentity: AgentIdentity = {
        ...fromIdentity,
        tone: { style: 'formal', verbosity: 'detailed' },
      };

      fromIdentity.tone = { style: 'casual', verbosity: 'brief' };

      const result = diff(fromIdentity, modifiedIdentity);

      const modChanges = result.changes.filter(c => c.type === 'modified');
      expect(modChanges.length).toBeGreaterThan(0);
    });

    it('should count changes correctly', () => {
      const result = diff(fromIdentity, toIdentity);

      expect(result.summary.totalChanges).toBe(result.changes.length);
      expect(result.summary.additions).toBe(result.changes.filter(c => c.type === 'added').length);
      expect(result.summary.removals).toBe(result.changes.filter(c => c.type === 'removed').length);
      expect(result.summary.modifications).toBe(result.changes.filter(c => c.type === 'modified').length);
    });

    it('should detect breaking changes', () => {
      const breakingIdentity: AgentIdentity = {
        ...fromIdentity,
        constraints: [], // Removed constraint
        capabilities: [
          { name: 'bash', type: 'tool', enabled: false }, // Disabled capability
        ],
      };

      const result = diff(fromIdentity, breakingIdentity);

      expect(result.summary.breakingChanges.length).toBeGreaterThan(0);
    });
  });

  describe('formatDiff', () => {
    it('should format diff as readable text', () => {
      const semanticDiff: SemanticDiff = {
        identityId: 'test-123',
        from: '1.0.0',
        to: '1.1.0',
        changes: [
          {
            type: 'added',
            path: 'goals',
            newValue: 'New goal',
            description: 'Added: New goal',
          },
          {
            type: 'removed',
            path: 'constraints',
            oldValue: 'Old constraint',
            description: 'Removed: Old constraint',
          },
        ],
        summary: {
          totalChanges: 2,
          additions: 1,
          removals: 1,
          modifications: 0,
          breakingChanges: ['Removed constraint'],
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      const formatted = formatDiff(semanticDiff);

      expect(formatted).toContain('Semantic Diff');
      expect(formatted).toContain('test-123');
      expect(formatted).toContain('From: 1.0.0');
      expect(formatted).toContain('➕');
      expect(formatted).toContain('➖');
      expect(formatted).toContain('Breaking Changes');
    });

    it('should show no breaking changes when clean', () => {
      const semanticDiff: SemanticDiff = {
        identityId: 'test-123',
        from: '1.0.0',
        to: '1.1.0',
        changes: [
          {
            type: 'added',
            path: 'goals',
            newValue: 'New goal',
            description: 'Added: New goal',
          },
        ],
        summary: {
          totalChanges: 1,
          additions: 1,
          removals: 0,
          modifications: 0,
          breakingChanges: [],
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      const formatted = formatDiff(semanticDiff);

      expect(formatted).not.toContain('Breaking Changes');
    });
  });
});
