import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto';

describe('Container Crypto', () => {
  const passphrase = 'strong-password-for-testing';
  const plaintext = Buffer.from('This is a secret message for the container.');

  it('should encrypt and decrypt a buffer successfully', async () => {
    const encrypted = await encrypt(plaintext, passphrase);
    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);

    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted).toBeInstanceOf(Buffer);
    expect(decrypted.toString()).toEqual(plaintext.toString());
  });

  it('should fail decryption with a wrong passphrase', async () => {
    const encrypted = await encrypt(plaintext, passphrase);
    const wrongPassphrase = 'wrong-password';

    await expect(decrypt(encrypted, wrongPassphrase)).rejects.toThrow(
      'Decryption failed. The passphrase may be incorrect or the data may be corrupted.',
    );
  });

  it('should fail decryption if the ciphertext is tampered with', async () => {
    const encrypted = await encrypt(plaintext, passphrase);
    
    // Tamper with the last byte of the ciphertext
    encrypted[encrypted.length - 1] = encrypted[encrypted.length - 1] ^ 1;

    await expect(decrypt(encrypted, passphrase)).rejects.toThrow(
      'Decryption failed. The passphrase may be incorrect or the data may be corrupted.',
    );
  });
  
    it('should fail decryption if the auth tag is tampered with', async () => {
    const encrypted = await encrypt(plaintext, passphrase);
    
    // Salt (16) + IV (12) = offset 28. Auth tag starts at index 28.
    // Tamper with a byte of the auth tag
    encrypted[28] = encrypted[28] ^ 1;

    await expect(decrypt(encrypted, passphrase)).rejects.toThrow(
      'Decryption failed. The passphrase may be incorrect or the data may be corrupted.',
    );
  });

  it('should handle empty plaintext buffer', async () => {
    const emptyPlaintext = Buffer.from('');
    const encrypted = await encrypt(emptyPlaintext, passphrase);
    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted.toString()).toEqual('');
  });
});
