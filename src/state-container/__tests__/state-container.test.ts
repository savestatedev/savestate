/**
 * StateContainer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  StateContainer,
  AgentPersonality,
  AgentTool,
  AgentPreferences,
  CONTAINER_VERSION
} from '../index.js';

describe('StateContainer', () => {
  let container: StateContainer;
  const passphrase = 'test-passphrase-123';

  beforeEach(() => {
    container = new StateContainer({ passphrase, encrypt: true });
  });

  describe('personality', () => {
    it('should set and get personality', () => {
      const personality: Partial<AgentPersonality> = {
        name: 'TestBot',
        role: 'Assistant',
        traits: ['helpful', 'friendly'],
        communicationStyle: 'casual',
      };
      
      container.setPersonality(personality);
      const result = container.getPersonality();
      
      expect(result.name).toBe('TestBot');
      expect(result.role).toBe('Assistant');
      expect(result.traits).toContain('helpful');
    });

    it('should use defaults for unset personality fields', () => {
      const result = container.getPersonality();
      
      expect(result.name).toBe('Unnamed Agent');
      expect(result.role).toBe('AI Assistant');
      expect(result.communicationStyle).toBe('casual');
    });
  });

  describe('tools', () => {
    it('should add and get tools', () => {
      const tool: AgentTool = {
        name: 'calculator',
        description: 'Performs calculations',
        function: {
          name: 'calculate',
          description: 'Calculate math expression',
          parameters: { expression: { type: 'string' } },
        },
        enabled: true,
      };
      
      container.addTool(tool);
      const tools = container.getTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('calculator');
    });

    it('should remove tools', () => {
      container.addTool({
        name: 'tool1',
        description: 'Tool 1',
        function: { name: 'tool1', description: '', parameters: {} },
        enabled: true,
      });
      container.addTool({
        name: 'tool2',
        description: 'Tool 2',
        function: { name: 'tool2', description: '', parameters: {} },
        enabled: true,
      });
      
      container.removeTool('tool1');
      const tools = container.getTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('tool2');
    });
  });

  describe('preferences', () => {
    it('should set and get preferences', () => {
      const prefs: Partial<AgentPreferences> = {
        language: 'en',
        temperature: 0.7,
        timezone: 'America/New_York',
      };
      
      container.setPreferences(prefs);
      const result = container.getPreferences();
      
      expect(result.language).toBe('en');
      expect(result.temperature).toBe(0.7);
    });

    it('should merge preferences', () => {
      container.setPreferences({ language: 'en' });
      container.setPreferences({ temperature: 0.5 });
      
      const result = container.getPreferences();
      
      expect(result.language).toBe('en');
      expect(result.temperature).toBe(0.5);
    });
  });

  describe('memory ref', () => {
    it('should set and get memory reference', () => {
      container.setMemoryRef('snap_12345');
      expect(container.getMemoryRef()).toBe('snap_12345');
    });
  });

  describe('conversation history', () => {
    it('should add messages', () => {
      container.addMessage('user', 'Hello');
      container.addMessage('assistant', 'Hi there');
      
      const history = container.getConversationHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('should limit conversation history to 100 messages', () => {
      for (let i = 0; i < 150; i++) {
        container.addMessage('user', `Message ${i}`);
      }
      
      const history = container.getConversationHistory();
      expect(history).toHaveLength(100);
    });
  });

  describe('custom data', () => {
    it('should set and get custom data', () => {
      container.setCustomData('key1', { nested: 'value' });
      expect(container.getCustomData('key1')).toEqual({ nested: 'value' });
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize encrypted container', () => {
      container.setPersonality({ name: 'EncryptedBot' });
      container.setPreferences({ temperature: 0.8 });
      
      const json = container.toJSON();
      const restored = StateContainer.fromJSON(json, passphrase);
      
      expect(restored.getPersonality().name).toBe('EncryptedBot');
      expect(restored.getPreferences().temperature).toBe(0.8);
      expect(restored.isEncrypted()).toBe(true);
    });

    it('should serialize unencrypted container', () => {
      const unencrypted = new StateContainer({ encrypt: false });
      unencrypted.setPersonality({ name: 'PlainBot' });
      
      const json = unencrypted.toJSON();
      const parsed = JSON.parse(json);
      
      expect(parsed.encrypted).toBe(false);
      expect(parsed.data).toContain('PlainBot');
    });

    it('should fail to decrypt with wrong passphrase', () => {
      container.setPersonality({ name: 'SecretBot' });
      const json = container.toJSON();
      
      expect(() => {
        StateContainer.fromJSON(json, 'wrong-passphrase');
      }).toThrow();
    });

    it('should preserve metadata through serialization', () => {
      container.setPersonality({ name: 'MetaBot' });
      container.setMemoryRef('snap_abc');
      
      const json = container.toJSON();
      const restored = StateContainer.fromJSON(json, passphrase);
      
      const metadata = restored.getMetadata();
      expect(metadata.version).toBe(CONTAINER_VERSION);
      expect(metadata.memoryRef).toBe('snap_abc');
    });
  });

  describe('metadata', () => {
    it('should track creation and modification times', () => {
      const metadata = container.getMetadata();
      
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.modifiedAt).toBeDefined();
      expect(metadata.version).toBe(CONTAINER_VERSION);
    });

    it('should update modifiedAt on changes', async () => {
      const original = container.getMetadata().modifiedAt;
      
      // Wait a tiny bit to ensure different timestamp
      await new Promise(r => setTimeout(r, 10));
      container.setPersonality({ name: 'UpdatedBot' });
      
      const updated = container.getMetadata().modifiedAt;
      expect(updated).not.toBe(original);
    });
  });
});
