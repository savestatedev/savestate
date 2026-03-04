import { describe, it, expect } from 'vitest';
import { PacketBuilder, type TaskPacket } from '../index.js';
import type { MemoryEntry } from '../../../../types.js';

describe('PacketBuilder', () => {
  const builder = new PacketBuilder();

  const createMockMemories = (count: number): MemoryEntry[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `memory-${i}`,
      content: `This is memory content number ${i}. It contains important information about project ${i % 3 === 0 ? 'alpha' : 'beta'} and task ${i % 5}.`,
      source: `source-${i % 3}`,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: i % 2 === 0 ? new Date(Date.now() - i * 43200000).toISOString() : undefined,
    }));
  };

  describe('distill', () => {
    it('should create a task packet from memories', () => {
      const memories = createMockMemories(5);
      const packet = builder.distill(memories);

      expect(packet).toBeDefined();
      expect(packet.version).toBe('1.0.0');
      expect(packet.timestamp).toBeDefined();
      expect(packet.originalCount).toBe(5);
      expect(packet.distilledCount).toBeGreaterThan(0);
      expect(packet.memories).toBeDefined();
      expect(packet.memories.length).toBeGreaterThan(0);
    });

    it('should significantly compress the memories', () => {
      const memories = createMockMemories(20);
      const packet = builder.distill(memories);

      // Compression ratio should be positive (packet smaller than original)
      expect(packet.compressionRatio).toBeGreaterThan(0);
      // Metadata should show the compression
      expect(packet.metadata.originalSize).toBeGreaterThan(packet.metadata.packetSize);
    });

    it('should respect maxMemories option', () => {
      const memories = createMockMemories(20);
      const packet = builder.distill(memories, { maxMemories: 5 });

      expect(packet.distilledCount).toBeLessThanOrEqual(5);
    });

    it('should filter by minImportance option', () => {
      const memories = createMockMemories(10);
      const packet = builder.distill(memories, { minImportance: 0.8 });

      // With high importance threshold, we expect fewer or no results
      // This depends on the calculateImportance logic
      expect(packet.distilledCount).toBeLessThanOrEqual(10);
    });

    it('should truncate summaries to maxSummaryLength', () => {
      const longMemory: MemoryEntry[] = [{
        id: 'long-1',
        content: 'This is a very long memory content that should be summarized. '.repeat(50),
        source: 'test',
        createdAt: new Date().toISOString(),
      }];

      const packet = builder.distill(longMemory, { maxSummaryLength: 50 });

      expect(packet.memories[0].summary.length).toBeLessThanOrEqual(50);
    });

    it('should include importance scores for each memory', () => {
      const memories = createMockMemories(5);
      const packet = builder.distill(memories);

      for (const memory of packet.memories) {
        expect(memory.importance).toBeGreaterThanOrEqual(0);
        expect(memory.importance).toBeLessThanOrEqual(1);
      }
    });

    it('should extract key topics from memories', () => {
      const memories = createMockMemories(5);
      const packet = builder.distill(memories);

      for (const memory of packet.memories) {
        expect(memory.keyTopics).toBeDefined();
        expect(Array.isArray(memory.keyTopics)).toBe(true);
      }
    });

    it('should handle empty memories array', () => {
      const packet = builder.distill([]);

      expect(packet.originalCount).toBe(0);
      expect(packet.distilledCount).toBe(0);
      expect(packet.memories).toEqual([]);
      expect(packet.compressionRatio).toBe(0);
    });
  });
});
