import { describe, expect, it } from 'vitest';
import { formatIdentitySchemaJson, type IdentitySchemaJson } from '../identity.js';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://savestate.ai/schemas/agent-identity/v1',
  title: 'Agent Identity',
  description: 'Canonical agent identity document for SaveState',
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      description: 'Agent name/identifier',
    },
    tools: {
      type: 'array',
      description: 'Tools/capabilities available to the agent',
      items: {
        type: 'object',
        properties: {
          config: { apiKey: 'ss_live_SECRET' },
        },
      },
    },
  },
  additionalProperties: false,
  secret: 'ss_live_SECRET',
};

describe('savestate identity schema --json', () => {
  it('prints a schema summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIdentitySchemaJson(schema)) as IdentitySchemaJson & {
      $schema?: unknown;
      description?: unknown;
      secret?: unknown;
      apiKey?: string;
    };
    expect(parsed).toEqual({
      id: 'https://savestate.ai/schemas/agent-identity/v1',
      title: 'Agent Identity',
      type: 'object',
      required: ['name'],
      properties: [
        { name: 'name', type: 'string' },
        { name: 'tools', type: 'array' },
      ],
      additionalProperties: false,
    });
    expect(parsed.$schema).toBeUndefined();
    expect(parsed.description).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records empty schema defaults without extra fields', () => {
    const parsed = JSON.parse(formatIdentitySchemaJson({})) as IdentitySchemaJson;
    expect(parsed.id).toBe('');
    expect(parsed.title).toBe('');
    expect(parsed.type).toBe('object');
    expect(parsed.required).toEqual([]);
    expect(parsed.properties).toEqual([]);
    expect(parsed.additionalProperties).toBe(false);
    expect(Object.keys(parsed).sort()).toEqual([
      'additionalProperties',
      'id',
      'properties',
      'required',
      'title',
      'type',
    ]);
  });
});
