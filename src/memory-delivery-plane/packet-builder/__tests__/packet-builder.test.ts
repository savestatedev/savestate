import { describe, expect, it } from 'vitest';
import PacketBuilder, {
  PacketPriority,
} from '../../packages/packet-builder/index.js';
import type { MemoryObject, Namespace } from '../../../checkpoint/types.js';

const namespace: Namespace = {
  org_id: 'org-1',
  app_id: 'app-1',
  agent_id: 'agent-1',
};

const memory = (id: string, importance: number, content: string): MemoryObject => ({
  memory_id: id,
  namespace,
  content,
  content_type: 'text',
  source: {} as MemoryObject['source'],
  ingestion: {} as MemoryObject['ingestion'],
  provenance: [],
  tags: ['product'],
  importance,
  task_criticality: importance,
  created_at: '2026-11-13T00:00:00.000Z',
  checkpoint_refs: [],
  version: 1,
  status: 'active',
});

describe('packet builder package entrypoint', () => {
  it('rejects invalid distillation limits', () => {
    expect(() => new PacketBuilder({ maxTokens: 0 })).toThrow('maxTokens must be a positive safe integer');
    expect(() => new PacketBuilder({ minImportance: 1.1 })).toThrow('minImportance must be between 0 and 1');

    const builder = new PacketBuilder();
    expect(() => builder.updateConfig({ maxMemories: -1 })).toThrow(
      'maxMemories must be a positive safe integer'
    );
  });

  it('uses the typed implementation and applies its distillation rules', () => {
    const builder = new PacketBuilder({ maxTokens: 20, minImportance: 0.5 });
    const result = builder.distill([
      memory('high', 0.9, 'Keep this important memory.'),
      memory('low', 0.2, 'Exclude this low priority memory.'),
    ], namespace);

    expect(result.packet.memories.map(({ memory_id }) => memory_id)).toEqual(['high']);
    expect(result.excludedCount).toBe(1);
    expect(result.packet.priority).toBe(PacketPriority.CRITICAL);
    expect(result.packet.estimated_tokens).toBeLessThanOrEqual(20);
  });
});
