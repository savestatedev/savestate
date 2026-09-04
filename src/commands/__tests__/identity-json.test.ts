import { describe, expect, it } from 'vitest';
import type { AgentIdentity } from '../../identity/schema.js';
import { formatIdentityJson, type IdentityJson } from '../identity.js';

const identity: AgentIdentity = {
  schemaVersion: '1.0.0',
  name: 'MyAgent',
  version: '1.0.0',
  goals: ['Help users'],
  tone: 'professional',
  constraints: ['Stay local'],
  tools: [
    {
      name: 'search',
      description: 'Search the archive',
      enabled: true,
      config: { apiKey: 'ss_live_SECRET' },
    },
  ],
  persona: 'A careful operator',
  instructions: 'Keep memory encrypted.',
  createdAt: '2026-09-04T12:00:00.000Z',
  updatedAt: '2026-09-04T12:00:00.000Z',
  metadata: { customKey: 'custom value' },
};

describe('savestate identity --json', () => {
  it('prints identity as JSON without tool config', () => {
    const parsed = JSON.parse(formatIdentityJson(identity)) as IdentityJson & {
      tools: Array<IdentityJson['tools'][number] & { config?: unknown }>;
    };
    expect(parsed).toEqual({
      name: 'MyAgent',
      version: '1.0.0',
      schemaVersion: '1.0.0',
      goals: ['Help users'],
      tone: 'professional',
      constraints: ['Stay local'],
      tools: [
        {
          name: 'search',
          description: 'Search the archive',
          enabled: true,
        },
      ],
      persona: 'A careful operator',
      instructions: 'Keep memory encrypted.',
      createdAt: '2026-09-04T12:00:00.000Z',
      updatedAt: '2026-09-04T12:00:00.000Z',
      metadata: { customKey: 'custom value' },
    });
    expect(parsed.tools[0].config).toBeUndefined();
  });

  it('records empty tools and null optional fields', () => {
    const parsed = JSON.parse(
      formatIdentityJson({
        schemaVersion: '1.0.0',
        name: 'BareAgent',
        version: '1.0.0',
        goals: [],
        constraints: [],
        tools: [],
        metadata: {},
      }),
    ) as IdentityJson;
    expect(parsed.name).toBe('BareAgent');
    expect(parsed.tone).toBeNull();
    expect(parsed.persona).toBeNull();
    expect(parsed.instructions).toBeNull();
    expect(parsed.createdAt).toBeNull();
    expect(parsed.updatedAt).toBeNull();
    expect(parsed.tools).toEqual([]);
    expect(parsed.metadata).toEqual({});
  });
});
