import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config.js', () => ({
  isInitialized: () => true,
  loadConfig: vi.fn(() => {
    throw new Error('loadConfig should not run when all search types are excluded');
  }),
}));

vi.mock('../../passphrase.js', () => ({
  getPassphrase: vi.fn(() => {
    throw new Error('getPassphrase should not run when all search types are excluded');
  }),
}));

import { searchCommand } from '../search.js';

describe('savestate search with every type excluded', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty JSON result without loading config or prompting', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await searchCommand('widget', {
      exclude: 'memory,conversation,identity,knowledge',
      jsonSummary: true,
    });

    const summary = JSON.parse(String(log.mock.calls.at(-1)?.[0])) as {
      found: boolean;
      results: unknown[];
      filters: { type: string[] | null };
    };
    expect(summary).toMatchObject({
      found: false,
      results: [],
      filters: { type: [] },
    });
  });
});
