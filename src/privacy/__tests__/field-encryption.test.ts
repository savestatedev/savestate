/**
 * Tests for field-level encryption
 */

import { describe, it, expect } from 'vitest';
import {
  encryptField,
  decryptField,
  isEncryptedField,
  encryptFields,
  decryptFields,
  rotateFieldKeys,
  defaultFieldEncryptionConfig,
} from '../field-encryption.js';

describe('Field-Level Encryption', () => {
  const testPassphrase = 'test-passphrase-12345';

  describe('encryptField / decryptField', () => {
    it('encrypts and decrypts a string', async () => {
      const original = 'Hello, World!';
      const encrypted = await encryptField(original, testPassphrase);

      expect(encrypted.__encrypted).toBe(true);
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.data).toBeDefined();
      expect(encrypted.meta?.type).toBe('string');

      const decrypted = await decryptField(encrypted, testPassphrase);
      expect(decrypted).toBe(original);
    });

    it('encrypts and decrypts an object', async () => {
      const original = { name: 'Test', value: 42 };
      const encrypted = await encryptField(original, testPassphrase);

      expect(encrypted.meta?.type).toBe('object');

      const decrypted = await decryptField(encrypted, testPassphrase);
      expect(decrypted).toEqual(original);
    });

    it('encrypts and decrypts an array', async () => {
      const original = ['a', 'b', 'c'];
      const encrypted = await encryptField(original, testPassphrase);

      expect(encrypted.meta?.type).toBe('array');

      const decrypted = await decryptField(encrypted, testPassphrase);
      expect(decrypted).toEqual(original);
    });

    it('fails decryption with wrong passphrase', async () => {
      const encrypted = await encryptField('secret', testPassphrase);

      await expect(decryptField(encrypted, 'wrong-passphrase'))
        .rejects.toThrow('Field decryption failed');
    });

    it('tracks key ID in metadata', async () => {
      const encrypted = await encryptField('test', testPassphrase, 'key-v1');
      expect(encrypted.meta?.keyId).toBe('key-v1');
    });
  });

  describe('isEncryptedField', () => {
    it('returns true for encrypted fields', async () => {
      const encrypted = await encryptField('test', testPassphrase);
      expect(isEncryptedField(encrypted)).toBe(true);
    });

    it('returns false for regular objects', () => {
      expect(isEncryptedField({ data: 'test' })).toBe(false);
      expect(isEncryptedField(null)).toBe(false);
      expect(isEncryptedField('string')).toBe(false);
      expect(isEncryptedField(123)).toBe(false);
    });
  });

  describe('encryptFields / decryptFields', () => {
    it('encrypts fields matching alwaysEncrypt patterns', async () => {
      const obj = {
        memory: {
          core: [
            { id: '1', content: 'secret memory' },
            { id: '2', content: 'another secret' },
          ],
        },
      };

      const config = {
        alwaysEncrypt: ['$.memory.core[*].content'],
        encryptIfPII: [],
        keyId: 'test-key',
        strength: 'standard' as const,
      };

      const { result, encryptedPaths } = await encryptFields(obj, config, testPassphrase);

      expect(encryptedPaths).toContain('$.memory.core[0].content');
      expect(encryptedPaths).toContain('$.memory.core[1].content');
      expect(isEncryptedField((result as any).memory.core[0].content)).toBe(true);
      expect(isEncryptedField((result as any).memory.core[1].content)).toBe(true);
    });

    it('encrypts fields containing PII when configured', async () => {
      const obj = {
        conversations: {
          messages: [
            { content: 'Email me at test@example.com' },
            { content: 'Just a normal message' },
          ],
        },
      };

      const config = {
        alwaysEncrypt: [],
        encryptIfPII: ['$.conversations.**.content'],
        keyId: 'test-key',
        strength: 'standard' as const,
      };

      // PII checker that returns true for emails
      const containsPII = (s: string) => s.includes('@');

      const { result, encryptedPaths } = await encryptFields(
        obj,
        config,
        testPassphrase,
        containsPII,
      );

      expect(encryptedPaths).toHaveLength(1);
      expect(isEncryptedField((result as any).conversations.messages[0].content)).toBe(true);
      // Second message has no PII, should not be encrypted
      expect((result as any).conversations.messages[1].content).toBe('Just a normal message');
    });

    it('decrypts all encrypted fields', async () => {
      const obj = {
        memory: {
          core: [{ content: 'secret' }],
        },
      };

      const config = {
        alwaysEncrypt: ['$.memory.core[*].content'],
        encryptIfPII: [],
        keyId: 'test-key',
        strength: 'standard' as const,
      };

      const { result: encrypted } = await encryptFields(obj, config, testPassphrase);
      const decrypted = await decryptFields(encrypted, testPassphrase);

      expect((decrypted as any).memory.core[0].content).toBe('secret');
    });

    it('preserves non-encrypted fields', async () => {
      const obj = {
        id: '123',
        metadata: { created: '2024-01-01' },
        content: 'encrypt this',
      };

      const config = {
        alwaysEncrypt: ['$.content'],
        encryptIfPII: [],
        keyId: 'test-key',
        strength: 'standard' as const,
      };

      const { result } = await encryptFields(obj, config, testPassphrase);

      expect((result as any).id).toBe('123');
      expect((result as any).metadata).toEqual({ created: '2024-01-01' });
      expect(isEncryptedField((result as any).content)).toBe(true);
    });
  });

  describe('rotateFieldKeys', () => {
    it('re-encrypts all fields with new passphrase', async () => {
      const obj = {
        secrets: [
          await encryptField('secret1', 'old-pass'),
          await encryptField('secret2', 'old-pass'),
        ],
      };

      const rotated = await rotateFieldKeys(obj, 'old-pass', 'new-pass', 'key-v2');

      // Should still be encrypted
      expect(isEncryptedField((rotated as any).secrets[0])).toBe(true);
      expect(isEncryptedField((rotated as any).secrets[1])).toBe(true);

      // Should decrypt with new passphrase
      const decrypted0 = await decryptField((rotated as any).secrets[0], 'new-pass');
      const decrypted1 = await decryptField((rotated as any).secrets[1], 'new-pass');
      expect(decrypted0).toBe('secret1');
      expect(decrypted1).toBe('secret2');

      // Should NOT decrypt with old passphrase
      await expect(decryptField((rotated as any).secrets[0], 'old-pass'))
        .rejects.toThrow();
    });
  });

  describe('defaultFieldEncryptionConfig', () => {
    it('provides sensible defaults', () => {
      const config = defaultFieldEncryptionConfig();

      expect(config.alwaysEncrypt).toContain('$.memory.core[*].content');
      expect(config.alwaysEncrypt).toContain('$.identity.personality');
      expect(config.encryptIfPII).toContain('$.conversations.**.content');
      expect(config.keyId).toMatch(/^key-\d+$/);
      expect(config.strength).toBe('standard');
    });
  });
});
