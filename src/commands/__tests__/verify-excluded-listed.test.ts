import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '../../container/crypto.js';
import { overlappingExcludedComponent, verifyContainer } from '../verify.js';

function createMagicHeader(version = 1): Buffer {
  const header = Buffer.alloc(16);
  header.write('SAVESTAT', 0, 'ascii');
  header.writeUInt8(version, 8);
  return header;
}

describe('savestate verify excluded listed membership', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'savestate-verify-excluded-listed-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function writeContainer(
    fileName: string,
    fields?: { components?: unknown; excluded?: unknown },
  ): Promise<string> {
    const passphrase = 'synthetic-verify-pass';
    const plaintext = Buffer.from(JSON.stringify({
      agentId: 'demo-agent',
      version: 1,
      exportedAt: '2026-08-22T06:00:00.000Z',
      memory: { facts: ['synthetic'] },
      tools: { enabled: [] },
    }));
    const encryptedState = await encrypt(plaintext, { passphrase });
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      created: '2026-08-22T06:00:00.000Z',
      agentId: 'demo-agent',
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: createHash('sha256').update(plaintext).digest('hex'),
        },
      ],
    };
    if (fields?.components !== undefined) {
      manifest.components = fields.components;
    }
    if (fields?.excluded !== undefined) {
      manifest.excluded = fields.excluded;
    }
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);
    const filePath = join(testDir, fileName);
    await writeFile(
      filePath,
      Buffer.concat([createMagicHeader(1), manifestLength, manifestBuffer, encryptedState]),
    );
    return filePath;
  }

  it('reports an excluded path that is also listed in components', () => {
    expect(overlappingExcludedComponent(['memory', 'tools'], ['memory'])).toBe('memory');
    expect(overlappingExcludedComponent(['tools'], ['memory'])).toBeUndefined();
  });

  it('rejects a container whose excluded list includes a listed component', async () => {
    const filePath = await writeContainer('overlap.savestate', {
      components: ['memory', 'tools'],
      excluded: ['memory'],
    });

    const result = await verifyContainer(filePath, { passphrase: 'synthetic-verify-pass' });

    expect(result.status).toBe('corrupted');
    expect(result.message).toBe('Invalid manifest: excluded path is listed: memory');
    expect(result.manifest).toBeUndefined();
  });

  it('accepts a disjoint pair and still verifies older files missing either field', async () => {
    const disjoint = await writeContainer('disjoint.savestate', {
      components: ['memory', 'tools'],
      excluded: ['personality'],
    });
    const componentsOnly = await writeContainer('components-only.savestate', {
      components: ['memory', 'tools'],
    });
    const excludedOnly = await writeContainer('excluded-only.savestate', {
      excluded: ['personality'],
    });
    const legacy = await writeContainer('legacy.savestate');

    const valid = await verifyContainer(disjoint, { passphrase: 'synthetic-verify-pass' });
    const listed = await verifyContainer(componentsOnly, { passphrase: 'synthetic-verify-pass' });
    const omitted = await verifyContainer(excludedOnly, { passphrase: 'synthetic-verify-pass' });
    const older = await verifyContainer(legacy, { passphrase: 'synthetic-verify-pass' });

    expect(valid.status).toBe('valid');
    expect(listed.status).toBe('valid');
    expect(omitted.status).toBe('valid');
    expect(older.status).toBe('valid');
  });
});
