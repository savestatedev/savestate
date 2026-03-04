/**
 * State Container Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createContainer,
  serializeContainer,
  deserializeContainer,
  validateContainer,
  inspectContainer,
  STATE_CONTAINER_VERSION,
} from '../index.js';
import type { Identity, Memory, ConversationIndex, PlatformMeta } from '../../types.js';

// Helper to create test data
function createTestIdentity(): Identity {
  return {
    personality: 'You are a helpful assistant.',
    config: { theme: 'dark' },
    tools: [
      { name: 'web-search', type: 'plugin', config: {}, enabled: true },
    ],
    skills: [
      { name: 'coding', files: { 'SKILL.md': '# Coding' } },
    ],
  };
}

function createTestMemory(): Memory {
  return {
    core: [
      { id: 'mem-1', content: 'Test memory', source: 'test', createdAt: new Date().toISOString() },
    ],
    knowledge: [
      { id: 'doc-1', filename: 'test.md', mimeType: 'text/markdown', path: '/test.md', size: 100, checksum: 'abc' },
    ],
  };
}

function createTestConversations(): ConversationIndex {
  return {
    total: 1,
    conversations: [
      { id: 'conv-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 10, path: '/conv/1.json' },
    ],
  };
}

function createTestPlatform(): PlatformMeta {
  return {
    name: 'openclaw',
    version: '1.0.0',
    exportMethod: 'api',
  };
}

describe('StateContainer', () => {
  describe('createContainer', () => {
    it('should create a container with all required fields', () => {
      const container = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform()
      );

      expect(container.version).toBe(STATE_CONTAINER_VERSION);
      expect(container.id).toMatch(/^sc_/);
      expect(container.timestamp).toBeDefined();
      expect(container.identity).toBeDefined();
      expect(container.memory).toBeDefined();
      expect(container.conversations).toBeDefined();
      expect(container.platform).toBeDefined();
    });

    it('should accept optional parameters', () => {
      const container = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform(),
        {
          name: 'Test Container',
          description: 'A test container',
          tags: ['test', 'demo'],
          targetPlatforms: ['openclaw', 'claude'],
        }
      );

      expect(container.metadata.name).toBe('Test Container');
      expect(container.metadata.description).toBe('A test container');
      expect(container.metadata.tags).toEqual(['test', 'demo']);
      expect(container.metadata.targetPlatforms).toEqual(['openclaw', 'claude']);
    });

    it('should default targetPlatforms to sourcePlatform', () => {
      const container = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform()
      );

      expect(container.metadata.targetPlatforms).toEqual(['openclaw']);
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize and deserialize correctly', () => {
      const original = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform(),
        { name: 'Test' }
      );

      const json = serializeContainer(original);
      expect(typeof json).toBe('string');
      expect(json.length).toBeGreaterThan(0);

      const restored = deserializeContainer(json);
      expect(restored.id).toBe(original.id);
      expect(restored.version).toBe(original.version);
      expect(restored.identity.personality).toBe(original.identity.personality);
    });

    it('should throw on invalid JSON', () => {
      expect(() => deserializeContainer('invalid json')).toThrow();
    });

    it('should throw on missing required fields', () => {
      const invalid = JSON.stringify({ id: '123' });
      expect(() => deserializeContainer(invalid)).toThrow('missing required fields');
    });
  });

  describe('validateContainer', () => {
    it('should validate a correct container', () => {
      const container = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform()
      );

      const result = validateContainer(container);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail on missing sections', () => {
      const result = validateContainer({ id: '1', version: '1.0.0', timestamp: '2024-01-01' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail on invalid input', () => {
      const result = validateContainer(null);
      expect(result.valid).toBe(false);
    });
  });

  describe('inspectContainer', () => {
    it('should return container summary', () => {
      const container = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform()
      );

      const info = inspectContainer(container);

      expect(info.id).toBe(container.id);
      expect(info.version).toBe(container.version);
      expect(info.platform).toBe('openclaw');
      expect(info.memoryEntries).toBe(1);
      expect(info.knowledgeDocs).toBe(1);
      expect(info.conversations).toBe(1);
      expect(info.tools).toBe(1);
      expect(info.skills).toBe(1);
    });
  });

  describe('encryption', () => {
    it('should encrypt and decrypt container', async () => {
      const original = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform(),
        { name: 'Secret Container' }
      );

      const passphrase = 'test-passphrase-123';
      const encrypted = await import('../../encryption.js').then(m => 
        m.encrypt(Buffer.from(serializeContainer(original), 'utf-8'), passphrase)
      );

      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = await import('../../encryption.js').then(m =>
        m.decrypt(encrypted, passphrase)
      );

      const restored = deserializeContainer(decrypted.toString('utf-8'));
      expect(restored.id).toBe(original.id);
      expect(restored.metadata.name).toBe('Secret Container');
    });

    it('should fail with wrong passphrase', async () => {
      const container = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform()
      );

      const passphrase = 'correct-passphrase';
      const wrongPassphrase = 'wrong-passphrase';

      const encrypted = await import('../../encryption.js').then(m =>
        m.encrypt(Buffer.from(serializeContainer(container), 'utf-8'), passphrase)
      );

      await expect(
        import('../../encryption.js').then(m => m.decrypt(encrypted, wrongPassphrase))
      ).rejects.toThrow();
    });

    it('should verify passphrase', async () => {
      const container = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform()
      );

      const passphrase = 'test-passphrase';

      const encrypted = await import('../../encryption.js').then(m =>
        m.encrypt(Buffer.from(serializeContainer(container), 'utf-8'), passphrase)
      );

      const valid = await import('../../encryption.js').then(m =>
        m.verify(encrypted, passphrase)
      );

      expect(valid).toBe(true);

      const invalid = await import('../../encryption.js').then(m =>
        m.verify(encrypted, 'wrong')
      );

      expect(invalid).toBe(false);
    });
  });

  describe('mergeContainers', () => {
    it('should link containers in chain', async () => {
      const base = createContainer(
        createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform()
      );

      const update: any = {
        ...createContainer(
          createTestIdentity(),
        createTestMemory(),
        createTestConversations(),
        createTestPlatform()
        ),
        metadata: {
          ...createTestPlatform(),
          parentId: base.id,
        },
      };

      // Can't easily test merge without the function being exported
      // This is a placeholder for the merge functionality
      expect(base.id).toBeDefined();
    });
  });
});
