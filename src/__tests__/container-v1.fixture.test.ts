import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeContainerV1 } from '../container/v1.js';

describe('SaveState Container v1 fixture', () => {
  it('decodes the checked-in minimal fixture', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const fixturePath = join(here, 'fixtures', 'container-v1', 'minimal.ssc');
    const buf = readFileSync(fixturePath);

    const decoded = decodeContainerV1(buf);

    expect(decoded.manifest.formatVersion).toBe('1.0.0');
    expect(decoded.manifest.payloads.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(decoded.payloads).sort()).toEqual(
      decoded.manifest.payloads.map(p => p.name).sort(),
    );

    // Spot-check payloads
    expect(decoded.payloads['identity/personality.md'].toString('utf-8')).toContain('SaveState');
    expect(JSON.parse(decoded.payloads['memory/core.json'].toString('utf-8'))).toHaveProperty('entries');
  });
});
