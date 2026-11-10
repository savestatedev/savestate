import { describe, expect, it } from 'vitest';
import { formatContextConfigPaginationMessages } from '../context.js';

describe('savestate context config pagination guidance', () => {
  it('points to the next page when a bounded page is partial', () => {
    expect(formatContextConfigPaginationMessages(2, 0)).toEqual([
      'More context config rows available; rerun with --offset 2.',
    ]);
  });

  it('points to the previous page and recovery page', () => {
    expect(formatContextConfigPaginationMessages(2, 100)).toEqual([
      'Earlier context config rows available; rerun with --offset 98.',
      'No context config rows found at this offset; rerun with --offset 6.',
    ]);
  });

  it('stays quiet when the full config fits on one page', () => {
    expect(formatContextConfigPaginationMessages()).toEqual([]);
  });
});
