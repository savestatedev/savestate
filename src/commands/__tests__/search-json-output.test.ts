import { describe, expect, it } from 'vitest';
import { isSearchJsonOutput } from '../search.js';

describe('savestate search output mode', () => {
  it('treats --json-summary as machine-readable output', () => {
    expect(isSearchJsonOutput({ json: false, jsonSummary: true })).toBe(true);
  });

  it('keeps the default search interactive', () => {
    expect(isSearchJsonOutput({ json: false, jsonSummary: false })).toBe(false);
  });
});
