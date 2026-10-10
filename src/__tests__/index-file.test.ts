import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getLatestEntry } from '../index-file.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('snapshot index latest entry', () => {
  it('chooses the same entry when timestamps are identical', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'savestate-index-'));
    temporaryDirectories.push(directory);
    await mkdir(join(directory, '.savestate'), { recursive: true });
    await writeFile(
      join(directory, '.savestate', 'index.json'),
      JSON.stringify({
        snapshots: [
          { id: 'zeta', timestamp: '2026-10-10T12:00:00.000Z', filename: 'zeta.saf.enc', size: 1 },
          { id: 'alpha', timestamp: '2026-10-10T12:00:00.000Z', filename: 'alpha.saf.enc', size: 1 },
        ],
      }),
    );

    await expect(getLatestEntry(directory)).resolves.toMatchObject({ id: 'alpha' });
  });
});
