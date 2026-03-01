/**
 * Agent Identity Schema (Issue #92)
 *
 * Defines the canonical agent identity document schema for semantic versioning
 * and diffing. The schema is extensible but has stable core fields.
 */

import { z } from 'zod';

/** Schema version for identity documents */
export const IDENTITY_SCHEMA_VERSION = '1.0.0';

/**
 * Tool reference in the identity document.
 * Represents a tool/capability the agent can use.
 */
export const ToolReferenceSchema = z.object({
  /** Tool identifier */
  name: z.string(),
  /** Tool description or purpose */
  description: z.string().optional(),
  /** Whether the tool is currently enabled */
  enabled: z.boolean().optional(),
  /** Tool-specific configuration */
  config: z.any().optional(),
});

export type ToolReference = z.infer<typeof ToolReferenceSchema>;

/**
 * Agent Identity Document Schema.
 *
 * Core fields are stable and should not change between versions.
 * The metadata field allows for extensibility.
 */
export const AgentIdentitySchema = z.object({
  /** Schema version for forward/backward compatibility */
  schemaVersion: z.string().default(IDENTITY_SCHEMA_VERSION),

  // ─── Core Identity Fields (stable) ─────────────────────────

  /** Agent name/identifier */
  name: z.string(),

  /** Identity document version (semantic versioning recommended) */
  version: z.string().default('1.0.0'),

  /** High-level goals the agent should pursue */
  goals: z.array(z.string()).default([]),

  /** Communication tone (e.g., "friendly", "professional", "casual") */
  tone: z.string().optional(),

  /** Behavioral constraints the agent must respect */
  constraints: z.array(z.string()).default([]),

  /** Tools/capabilities available to the agent */
  tools: z.array(ToolReferenceSchema).default([]),

  /** Agent persona description (who the agent is) */
  persona: z.string().optional(),

  /** Detailed instructions for the agent's behavior */
  instructions: z.string().optional(),

  // ─── Timestamps ────────────────────────────────────────────

  /** ISO 8601 timestamp of identity creation */
  createdAt: z.string().optional(),

  /** ISO 8601 timestamp of last identity update */
  updatedAt: z.string().optional(),

  // ─── Extension Point ───────────────────────────────────────

  /** Extensible metadata for custom fields */
  metadata: z.record(z.string(), z.any()).default({}),
});

export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;

/**
 * Validate an agent identity document.
 *
 * @param data - Raw identity document data
 * @returns Validated AgentIdentity or throws ZodError
 */
export function validateIdentity(data: unknown): AgentIdentity {
  return AgentIdentitySchema.parse(data);
}

/**
 * Safely validate an agent identity document.
 *
 * @param data - Raw identity document data
 * @returns Result object with success/error state
 */
export function safeValidateIdentity(data: unknown): {
  success: boolean;
  data?: AgentIdentity;
  error?: z.ZodError;
} {
  const result = AgentIdentitySchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Create a minimal valid identity document.
 *
 * @param name - Agent name
 * @param overrides - Optional field overrides
 * @returns Valid AgentIdentity
 */
export function createIdentity(
  name: string,
  overrides?: Partial<AgentIdentity>,
): AgentIdentity {
  const now = new Date().toISOString();
  return AgentIdentitySchema.parse({
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    name,
    version: '1.0.0',
    goals: [],
    constraints: [],
    tools: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

/**
 * Generate JSON Schema from the Zod schema (for external validation).
 *
 * This provides a standards-compliant JSON Schema representation
 * that can be used by external tools and validators.
 */
export function getJsonSchema(): object {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://savestate.ai/schemas/agent-identity/v1',
    title: 'Agent Identity',
    description: 'Canonical agent identity document for SaveState',
    type: 'object',
    required: ['name'],
    properties: {
      schemaVersion: {
        type: 'string',
        description: 'Schema version for forward/backward compatibility',
        default: IDENTITY_SCHEMA_VERSION,
      },
      name: {
        type: 'string',
        description: 'Agent name/identifier',
      },
      version: {
        type: 'string',
        description: 'Identity document version (semantic versioning)',
        default: '1.0.0',
      },
      goals: {
        type: 'array',
        items: { type: 'string' },
        description: 'High-level goals the agent should pursue',
        default: [],
      },
      tone: {
        type: 'string',
        description: 'Communication tone (e.g., "friendly", "professional")',
      },
      constraints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Behavioral constraints the agent must respect',
        default: [],
      },
      tools: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            enabled: { type: 'boolean', default: true },
            config: { type: 'object' },
          },
        },
        description: 'Tools/capabilities available to the agent',
        default: [],
      },
      persona: {
        type: 'string',
        description: 'Agent persona description',
      },
      instructions: {
        type: 'string',
        description: 'Detailed instructions for agent behavior',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'ISO 8601 timestamp of identity creation',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'ISO 8601 timestamp of last update',
      },
      metadata: {
        type: 'object',
        description: 'Extensible metadata for custom fields',
        additionalProperties: true,
        default: {},
      },
    },
    additionalProperties: false,
  };
}

/**
 * Core identity fields that are compared in semantic diffs.
 * Changes to these fields are considered significant.
 */
export const CORE_IDENTITY_FIELDS = [
  'name',
  'version',
  'goals',
  'tone',
  'constraints',
  'tools',
  'persona',
  'instructions',
] as const;

export type CoreIdentityField = (typeof CORE_IDENTITY_FIELDS)[number];
