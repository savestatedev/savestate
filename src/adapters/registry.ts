/**
 * Adapter Registry
 *
 * Discovers and manages available platform adapters.
 * Built-in adapters are registered automatically.
 * External adapters can be installed as npm packages
 * following the naming convention @savestate/adapter-*.
 *
 * Detection order: Clawdbot > Claude Code > OpenAI Assistants
 * More specific adapters are preferred over generic ones.
 * If both Clawdbot and Claude Code markers exist, Clawdbot wins.
 */

import type { Adapter } from '../types.js';
import { ClawdbotAdapter } from './clawdbot.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { ClaudeWebAdapter } from './claude-web.js';
import { OpenAIAssistantsAdapter } from './openai-assistants.js';
import { ChatGPTAdapter } from './chatgpt.js';
import { GeminiAdapter } from './gemini.js';

/** Registry of all known adapters */
const adapters = new Map<string, () => Adapter>();

/**
 * Register a built-in adapter factory.
 */
function register(id: string, factory: () => Adapter): void {
  adapters.set(id, factory);
}

/**
 * Get all registered adapter IDs.
 */
export function listAdapters(): string[] {
  return [...adapters.keys()];
}

/**
 * Get a specific adapter by ID.
 */
export function getAdapter(id: string): Adapter | null {
  const factory = adapters.get(id);
  return factory ? factory() : null;
}

/**
 * Auto-detect which adapter to use for the current environment.
 * Tries each adapter's detect() method in priority order.
 * Clawdbot is checked first (most specific for Moltbot workspaces).
 */
export async function detectAdapter(): Promise<Adapter | null> {
  for (const [, factory] of adapters) {
    const adapter = factory();
    if (await adapter.detect()) {
      return adapter;
    }
  }
  return null;
}

/**
 * Get detailed info about all adapters, including detection status.
 */
export async function getAdapterInfo(): Promise<
  Array<{
    id: string;
    name: string;
    platform: string;
    version: string;
    detected: boolean;
  }>
> {
  const results = [];
  for (const [, factory] of adapters) {
    const adapter = factory();
    results.push({
      id: adapter.id,
      name: adapter.name,
      platform: adapter.platform,
      version: adapter.version,
      detected: await adapter.detect(),
    });
  }
  return results;
}

// ─── Register built-in adapters ─────────────────────────────
// Order matters! First match wins in detectAdapter().
// Clawdbot is more specific than Claude Code (it has SOUL.md, memory/, etc.)
// so it should be checked first.

register('clawdbot', () => new ClawdbotAdapter());
register('claude-code', () => new ClaudeCodeAdapter());
register('claude-web', () => new ClaudeWebAdapter());
register('openai-assistants', () => new OpenAIAssistantsAdapter());
register('chatgpt', () => new ChatGPTAdapter());
register('gemini', () => new GeminiAdapter());
