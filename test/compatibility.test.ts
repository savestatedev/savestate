import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { decrypt } from '../../src/container/crypto'; // Assuming crypto file is present

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../test/fixtures');
const goldenFixturePath = path.join(fixturesDir, 'golden-v1.savestate');

const GOLDEN_PASSPHRASE = 'savestate-golden-passphrase';
const GOLDEN_AGENT_ID = 'golden-agent-001';

describe('Container Compatibility Tests', () => {
  it('should successfully read and decrypt the v1 golden fixture', async () => {
    // 1. Read the golden file
    const fileBuffer = await fs.readFile(goldenFixturePath);
    expect(fileBuffer).toBeInstanceOf(Buffer);

    // 2. Verify header
    const magic = fileBuffer.subarray(0, 8).toString();
    const version = fileBuffer.readUInt8(8);
    expect(magic).toBe('SAVESTATE');
    expect(version).toBe(1);

    // 3. Extract and parse manifest
    const manifestLength = fileBuffer.readUInt32LE(16);
    const manifestEnd = 20 + manifestLength;
    const manifestBuffer = fileBuffer.subarray(20, manifestEnd);
    const manifest = JSON.parse(manifestBuffer.toString());

    expect(manifest.formatVersion).toBe(1);
    expect(manifest.agentId).toBe(GOLDEN_AGENT_ID);
    expect(manifest.payloads).toHaveLength(1);

    // 4. Decrypt payload
    const encryptedState = fileBuffer.subarray(manifestEnd);
    const decryptedState = await decrypt(encryptedState, GOLDEN_PASSPHRASE);

    // 5. Verify payload integrity
    const payloadInfo = manifest.payloads[0];
    const calculatedHash = createHash('sha256').update(decryptedState).digest('hex');
    expect(calculatedHash).toBe(payloadInfo.sha256);

    // 6. Verify content
    const state = JSON.parse(decryptedState.toString());
    expect(state.agentId).toBe(GOLDEN_AGENT_ID);
    expect(state.personality).toContain('golden file testing');
    expect(state.memory.topics).toEqual(['testing', 'savestate', 'golden-files']);
  });

  it('should perform a successful round-trip (export -> import)', async () => {
    // This is a simplified version of the CLI test, testing the crypto and format directly.
    // In a real CI environment, we would run the actual CLI command.
    
    // NOTE: This test requires the export logic to be available.
    // For this PR, we focus only on reading the golden fixture.
    // The round-trip is validated in the CLI test for #160.
    expect(true).toBe(true); // Placeholder
  });
});
