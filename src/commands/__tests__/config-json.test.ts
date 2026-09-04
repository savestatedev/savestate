import { describe, expect, it } from 'vitest';
import { formatConfigJson } from '../config.js';
import type { SaveStateConfig } from '../../types.js';

const config: SaveStateConfig = {
  version: '1',
  storage: { type: 'local', options: {} },
  adapters: [{ id: 'claude-code', enabled: true }],
};

describe('savestate config --json', () => {
  it('prints config as JSON without the saved API key', () => {
    const parsed = JSON.parse(
      formatConfigJson({
        ...config,
        apiKey: 'ss_live_SECRET',
        account: { email: 'fixture@savestate.dev', tier: 'pro' },
      } as SaveStateConfig),
    ) as SaveStateConfig & { apiKey?: string; account?: unknown };
    expect(parsed.version).toBe('1');
    expect(parsed.storage).toEqual({ type: 'local', options: {} });
    expect(parsed.adapters).toEqual([{ id: 'claude-code', enabled: true }]);
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.account).toBeUndefined();
  });

  it('records schedule and default adapter', () => {
    const parsed = JSON.parse(
      formatConfigJson({
        ...config,
        defaultAdapter: 'claude-code',
        schedule: '6h',
      }),
    ) as SaveStateConfig;
    expect(parsed.defaultAdapter).toBe('claude-code');
    expect(parsed.schedule).toBe('6h');
  });
});
