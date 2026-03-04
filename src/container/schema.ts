/**
 * Agent State Schema for Portable Container
 * Issue #104: Defines what's inside the encrypted container
 */

import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Agent identity - who the agent is
 */
export const AgentIdentitySchema = z.object({
  name: z.string(),
  personality: z.string().optional(),
  voice: z.string().optional(),
  persona: z.string().optional(),
  instructions: z.string().optional(),
  goals: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;

/**
 * Memory entry
 */
export const MemoryEntrySchema = z.object({
  id: z.string(),
  content: z.string(),
  type: z.enum(['fact', 'preference', 'decision', 'error', 'api_response', 'custom']).optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

/**
 * Conversation message
 */
export const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  timestamp: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

/**
 * Tool configuration
 */
export const ToolConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

/**
 * Complete agent state - the payload inside the container
 */
export const AgentStateSchema = z.object({
  schema_version: z.string(),
  identity: AgentIdentitySchema,
  memories: z.array(MemoryEntrySchema).optional(),
  preferences: z.record(z.unknown()).optional(),
  history: z.array(ConversationMessageSchema).optional(),
  tools: z.array(ToolConfigSchema).optional(),
  custom: z.record(z.unknown()).optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

/**
 * Validate agent state against schema
 */
export function validateAgentState(state: unknown): { valid: boolean; errors?: string[] } {
  const result = AgentStateSchema.safeParse(state);
  
  if (result.success) {
    return { valid: true };
  }
  
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
  return { valid: false, errors };
}

/**
 * Create a minimal valid agent state
 */
export function createEmptyAgentState(name: string): AgentState {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    identity: { name },
    memories: [],
    preferences: {},
    history: [],
    tools: [],
    custom: {},
  };
}

/**
 * Migrate state from older schema version
 */
export function migrateSchema(state: AgentState, targetVersion: string = CURRENT_SCHEMA_VERSION): AgentState {
  // For now, just update the version since we're at 1.0.0
  // Future migrations would go here
  return {
    ...state,
    schema_version: targetVersion,
  };
}
