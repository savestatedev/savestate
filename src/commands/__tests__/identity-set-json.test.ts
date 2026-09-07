import { describe, expect, it } from 'vitest';
import { formatIdentitySetJson, type IdentitySetJson } from '../identity.js';

const result: IdentitySetJson & { secret?: string; tools?: unknown } = {
  updated: true,
  field: 'tone',
  name: 'MyAgent',
  version: '1.0.1',
  secret: 'ss_live_SECRET',
  tools: [{ name: 'search', config: { apiKey: 'ss_live_SECRET' } }],
};

describe('savestate identity set --json', () => {
  it('prints a set summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIdentitySetJson(result)) as IdentitySetJson & {
      secret?: unknown;
      apiKey?: string;
      tools?: unknown;
      persona?: unknown;
      instructions?: unknown;
      value?: unknown;
    };
    expect(parsed).toEqual({
      updated: true,
      field: 'tone',
      name: 'MyAgent',
      version: '1.0.1',
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.tools).toBeUndefined();
    expect(parsed.persona).toBeUndefined();
    expect(parsed.instructions).toBeUndefined();
    expect(parsed.value).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a nested metadata field without extra fields', () => {
    const parsed = JSON.parse(
      formatIdentitySetJson({
        updated: true,
        field: 'metadata.customKey',
        name: 'BareAgent',
        version: '1.0.0',
      }),
    ) as IdentitySetJson;
    expect(parsed.updated).toBe(true);
    expect(parsed.field).toBe('metadata.customKey');
    expect(parsed.name).toBe('BareAgent');
    expect(parsed.version).toBe('1.0.0');
    expect(Object.keys(parsed).sort()).toEqual([
      'field',
      'name',
      'updated',
      'version',
    ]);
  });
});
