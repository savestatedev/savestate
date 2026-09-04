import { describe, expect, it } from 'vitest';
import { formatInitResultJson, type InitResult } from '../init.js';

const result: InitResult = {
  initialized: true,
  alreadyInitialized: false,
  configDir: '/tmp/savestate-fixture/.savestate',
  adapter: 'claude-code',
  passphraseConfigured: true,
};

describe('savestate init --json', () => {
  it('prints init status as JSON', () => {
    const parsed = JSON.parse(formatInitResultJson(result)) as InitResult & { passphrase?: string };
    expect(parsed.initialized).toBe(true);
    expect(parsed.alreadyInitialized).toBe(false);
    expect(parsed.configDir).toBe('/tmp/savestate-fixture/.savestate');
    expect(parsed.adapter).toBe('claude-code');
    expect(parsed.passphraseConfigured).toBe(true);
    expect(parsed.passphrase).toBeUndefined();
  });

  it('records an already-initialized workspace with no adapter', () => {
    const parsed = JSON.parse(
      formatInitResultJson({
        initialized: true,
        alreadyInitialized: true,
        configDir: '/tmp/existing/.savestate',
        adapter: null,
        passphraseConfigured: false,
      }),
    ) as InitResult;
    expect(parsed.alreadyInitialized).toBe(true);
    expect(parsed.adapter).toBeNull();
    expect(parsed.passphraseConfigured).toBe(false);
  });
});
