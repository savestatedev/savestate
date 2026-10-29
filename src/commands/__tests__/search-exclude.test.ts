import { describe, expect, it } from 'vitest';
import { formatSearchFilterHints, parseSearchExclude, resolveSearchType } from '../search.js';

describe('savestate search --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseSearchExclude(undefined)).toBeUndefined();
  });

  it('accepts known types', () => {
    expect(parseSearchExclude('memory')).toEqual(['memory']);
    expect(parseSearchExclude('conversation, identity')).toEqual(['conversation', 'identity']);
    expect(parseSearchExclude('memory,conversation,identity,knowledge')).toEqual([
      'memory',
      'conversation',
      'identity',
      'knowledge',
    ]);
  });

  it('normalizes casing and removes repeated exclusions', () => {
    expect(parseSearchExclude(' MEMORY,conversation,memory ')).toEqual(['memory', 'conversation']);
  });

  it.each(['nope', '', 'memory,bogus', ',,', 'memory,', 'memory,,conversation'])('rejects invalid value %s', (value) => {
    expect(() => parseSearchExclude(value)).toThrow(
      `Invalid --exclude value "${value}". Expected one or more of: memory, conversation, identity, knowledge.`,
    );
  });

  it('drops excluded types from the default set', () => {
    expect(resolveSearchType({ exclude: 'conversation' })).toEqual([
      'memory',
      'identity',
      'knowledge',
    ]);
  });

  it('drops excluded types from --type', () => {
    expect(resolveSearchType({ type: 'memory,conversation', exclude: 'conversation' })).toEqual([
      'memory',
    ]);
  });

  it('formats inclusion and exclusion filters for interactive output', () => {
    expect(formatSearchFilterHints(['memory'], ['conversation', 'knowledge'])).toEqual([
      'Filter: memory',
      'Exclude: conversation, knowledge',
    ]);
  });

  it('makes an empty effective filter explicit when every type is excluded', () => {
    expect(formatSearchFilterHints([], ['memory', 'conversation', 'identity', 'knowledge'])).toEqual([
      'Filter: none',
      'Exclude: memory, conversation, identity, knowledge',
    ]);
  });

  it('does not render an empty exclusion hint', () => {
    expect(formatSearchFilterHints(undefined, [])).toEqual([]);
  });
});
