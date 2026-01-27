/**
 * Adapter Registry
 *
 * Discovers and manages available platform adapters.
 * Built-in adapters are registered automatically.
 * External adapters can be installed as npm packages
 * following the naming convention @savestate/adapter-*.
 */

import type { Adapter } from '../types.js';
import { ClawdbotAdapter } from './clawdbot.js';

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
 * Tries each adapter's detect() method and returns the first match.
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

register('clawdbot', () => new ClawdbotAdapter());

// Future adapters:
// register('chatgpt', () => new ChatGPTAdapter());
// register('claude', () => new ClaudeAdapter());
// register('openai-assistants', () => new OpenAIAssistantsAdapter());
