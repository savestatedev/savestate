import { describe, expect, it } from 'vitest';
import { applyAdaptersFilters, parseAdaptersPlatform, type AdapterListEntry } from '../adapters.js';

const adapters: AdapterListEntry[] = [
  { id: 'chatgpt', name: 'ChatGPT', platform: 'chatgpt', version: '1.0.0', detected: false },
];

describe('savestate adapters --platform', () => {
  it('trims a platform ID before filtering', () => {
    expect(applyAdaptersFilters(adapters, { platform: ' chatgpt ' })).toEqual(adapters);
  });

  it('rejects an empty platform ID', () => {
    expect(() => parseAdaptersPlatform('   ')).toThrow(
      'Invalid --platform value. Expected a non-empty platform ID.',
    );
  });
});
