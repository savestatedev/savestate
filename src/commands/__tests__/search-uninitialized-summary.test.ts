import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config.js', async () => {
  const actual = await vi.importActual<typeof import('../../config.js')>('../../config.js');
  return {
    ...actual,
    isInitialized: () => false,
  };
});

import { searchCommand } from '../search.js';

describe('savestate search --json-summary when uninitialized', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports effective types after applying exclusions', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await searchCommand('cocktail', {
      jsonSummary: true,
      type: 'memory,conversation',
      exclude: 'conversation',
    });

    const summary = JSON.parse(String(log.mock.calls.at(-1)?.[0])) as {
      filters: { type: string[] | null; exclude: string[] | null };
    };
    expect(summary.filters).toMatchObject({
      type: ['memory'],
      exclude: ['conversation'],
    });
  });
});
