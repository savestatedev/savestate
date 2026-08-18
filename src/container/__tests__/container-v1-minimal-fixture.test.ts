import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../test/fixtures/container-v1-minimal.json'
);

const REQUIRED_PAYLOAD_FIELDS = ['name', 'contentType', 'byteLength', 'sha256'] as const;

describe('container-v1-minimal fixture', () => {
  it('matches the documented v1 required fields', () => {
    const manifest = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      formatVersion: number;
      created: string;
      payloads: Array<Record<string, unknown>>;
    };

    expect(manifest.formatVersion).toBe(1);
    expect(manifest.created).toBe('2026-03-04T12:00:00Z');
    expect(Array.isArray(manifest.payloads)).toBe(true);
    expect(manifest.payloads.length).toBeGreaterThan(0);

    for (const payload of manifest.payloads) {
      for (const field of REQUIRED_PAYLOAD_FIELDS) {
        expect(payload[field], field).toBeTruthy();
      }
      expect(payload.byteLength).toBe(44);
      expect(payload.sha256).toBe(
        '847c0a3ba356da0c127ec6a4b13f163dbca6e493887da801463e20bda8687122'
      );
    }
  });
});
