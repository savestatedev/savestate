/**
 * PacketBuilder Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PacketBuilder, PacketPriority, TaskPacket } from '../index.js';
import { MemoryObject, Namespace } from '../../../checkpoint/types.js';

describe('PacketBuilder', () => {
  let builder: PacketBuilder;
  const namespace: Namespace = {
    org_id: 'test-org',
    app_id: 'test-app',
    agent_id: 'test-agent',
    user_id: 'test-user',
  };

  const createMemory = (overrides: Partial<MemoryObject> = {}): MemoryObject => ({
    memory_id: `mem_${Math.random().toString(36).substring(7)}`,
    namespace,
    content: 'Test memory content',
    content_type: 'text',
    source: { type: 'user_input', identifier: 'user-1' },
    ingestion: {
      source_type: 'user_input',
      source_id: 'source-1',
      ingestion_timestamp: new Date().toISOString(),
      confidence_score: 0.9,
      detected_format: 'text',
      anomaly_flags: [],
      quarantined: false,
      validation_notes: [],
    },
    provenance: [],
    tags: ['test'],
    importance: 0.5,
    task_criticality: 0.5,
    created_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    builder = new PacketBuilder();
  });

  describe('distill', () => {
    it('should create a packet with single memory', () => {
      const memories = [createMemory({ content: 'Important info', importance: 0.9 })];
      const result = builder.distill(memories, namespace);

      expect(result.packet).toBeDefined();
      expect(result.packet.memories).toHaveLength(1);
      expect(result.packet.memories[0].content).toBe('Important info');
      expect(result.packet.priority).toBe(PacketPriority.CRITICAL);
    });

    it('should sort memories by importance (descending)', () => {
      const memories = [
        createMemory({ content: 'Low importance', importance: 0.4 }), // above 0.3 threshold
        createMemory({ content: 'High importance', importance: 0.9 }),
        createMemory({ content: 'Medium importance', importance: 0.5 }),
      ];
      const result = builder.distill(memories, namespace);

      expect(result.packet.memories[0].importance).toBe(0.9);
      expect(result.packet.memories[1].importance).toBe(0.5);
      expect(result.packet.memories[2].importance).toBe(0.4);
    });

    it('should filter memories below minImportance threshold', () => {
      const memories = [
        createMemory({ content: 'High importance', importance: 0.9 }),
        createMemory({ content: 'Low importance', importance: 0.1 }),
      ];
      const result = builder.distill(memories, namespace);

      expect(result.packet.memories).toHaveLength(1);
      expect(result.excludedCount).toBe(1);
    });

    it('should respect maxTokens limit', () => {
      const longContent = 'A'.repeat(20000); // ~5000 tokens (exceeds 4000 limit)
      const memories = [
        createMemory({ content: longContent, importance: 0.9 }),
        createMemory({ content: 'More content', importance: 0.8 }),
      ];
      const result = builder.distill(memories, namespace);

      // Should include first memory but truncate second
      expect(result.truncated).toBe(true);
      expect(result.packet.memories).toHaveLength(1);
    });

    it('should respect maxMemories limit', () => {
      const memories = Array.from({ length: 100 }, (_, i) =>
        createMemory({ content: `Memory ${i}`, importance: 1 - i * 0.01 })
      );
      const result = builder.distill(memories, namespace);

      expect(result.packet.memories.length).toBeLessThanOrEqual(50);
      expect(result.truncated).toBe(true);
    });

    it('should set correct priority based on importance', () => {
      const critical = builder.distill(
        [createMemory({ importance: 0.95 })],
        namespace
      );
      expect(critical.packet.priority).toBe(PacketPriority.CRITICAL);

      // Use 0.65 - avgImportance = 0.65 which is < 0.7 but maxImportance >= 0.7
      const high = builder.distill(
        [createMemory({ importance: 0.65 })],
        namespace
      );
      expect(high.packet.priority).toBe(PacketPriority.HIGH);

      // Use 0.45 - maxImportance < 0.5 but >= 0.3
      const medium = builder.distill(
        [createMemory({ importance: 0.45 })],
        namespace
      );
      expect(medium.packet.priority).toBe(PacketPriority.MEDIUM);

      const low = builder.distill(
        [createMemory({ importance: 0.2 })],
        namespace
      );
      expect(low.packet.priority).toBe(PacketPriority.LOW);
    });

    it('should include namespace in packet', () => {
      const result = builder.distill([createMemory()], namespace);
      
      expect(result.packet.namespace.org_id).toBe('test-org');
      expect(result.packet.namespace.app_id).toBe('test-app');
    });

    it('should track original_count correctly', () => {
      const memories = [
        createMemory({ importance: 0.9 }),
        createMemory({ importance: 0.1 }), // filtered out
      ];
      const result = builder.distill(memories, namespace);

      expect(result.packet.original_count).toBe(2);
    });
  });

  describe('configuration', () => {
    it('should use default config', () => {
      const config = builder.getConfig();
      
      expect(config.maxTokens).toBe(4000);
      expect(config.minImportance).toBe(0.3);
      expect(config.maxMemories).toBe(50);
    });

    it('should accept custom config', () => {
      const customBuilder = new PacketBuilder({
        maxTokens: 2000,
        minImportance: 0.5,
        maxMemories: 10,
      });
      
      const config = customBuilder.getConfig();
      expect(config.maxTokens).toBe(2000);
      expect(config.minImportance).toBe(0.5);
      expect(config.maxMemories).toBe(10);
    });

    it('should update config', () => {
      builder.updateConfig({ maxTokens: 1000 });
      
      const config = builder.getConfig();
      expect(config.maxTokens).toBe(1000);
      expect(config.minImportance).toBe(0.3); // unchanged
    });
  });
});
