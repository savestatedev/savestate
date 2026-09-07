import { describe, expect, it } from 'vitest';
import { formatIdentityInitJson, type IdentityInitJson } from '../identity.js';

const result: IdentityInitJson & { secret?: string; tools?: unknown } = {
  created: true,
  alreadyExists: false,
  path: '/tmp/savestate-fixture/.savestate/identity.json',
  name: 'MyAgent',
  version: '1.0.0',
  secret: 'ss_live_SECRET',
  tools: [{ name: 'search', config: { apiKey: 'ss_live_SECRET' } }],
};

describe('savestate identity init --json', () => {
  it('prints an init summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIdentityInitJson(result)) as IdentityInitJson & {
      secret?: unknown;
      apiKey?: string;
      tools?: unknown;
      persona?: unknown;
      instructions?: unknown;
    };
    expect(parsed).toEqual({
      created: true,
      alreadyExists: false,
      path: '/tmp/savestate-fixture/.savestate/identity.json',
      name: 'MyAgent',
      version: '1.0.0',
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.tools).toBeUndefined();
    expect(parsed.persona).toBeUndefined();
    expect(parsed.instructions).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records an already-existing identity without extra fields', () => {
    const parsed = JSON.parse(
      formatIdentityInitJson({
        created: false,
        alreadyExists: true,
        path: '.savestate/identity.json',
        name: 'BareAgent',
        version: '1.0.0',
      }),
    ) as IdentityInitJson;
    expect(parsed.created).toBe(false);
    expect(parsed.alreadyExists).toBe(true);
    expect(parsed.path).toBe('.savestate/identity.json');
    expect(parsed.name).toBe('BareAgent');
    expect(parsed.version).toBe('1.0.0');
    expect(Object.keys(parsed).sort()).toEqual([
      'alreadyExists',
      'created',
      'name',
      'path',
      'version',
    ]);
  });
});
