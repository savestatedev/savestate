/**
 * Transformer Registry
 *
 * Manages available transformers for platform-to-platform conversions.
 * Transformers are keyed by "source→target" pairs.
 */

import type { Platform, Transformer } from '../types.js';

const transformers = new Map<string, () => Transformer>();

/**
 * Create a key for the transformer map.
 */
function transformerKey(source: Platform, target: Platform): string {
  return `${source}→${target}`;
}

/**
 * Register a transformer for a source→target pair.
 */
export function registerTransformer(
  source: Platform,
  target: Platform,
  factory: () => Transformer,
): void {
  transformers.set(transformerKey(source, target), factory);
}

/**
 * Get a transformer for a source→target pair.
 */
export function getTransformer(source: Platform, target: Platform): Transformer | null {
  const factory = transformers.get(transformerKey(source, target));
  return factory ? factory() : null;
}

/**
 * List all registered transformer pairs.
 */
export function listTransformers(): Array<{ source: Platform; target: Platform }> {
  return [...transformers.keys()].map((key) => {
    const [source, target] = key.split('→') as [Platform, Platform];
    return { source, target };
  });
}

/**
 * Check if a transformer exists for a source→target pair.
 */
export function hasTransformer(source: Platform, target: Platform): boolean {
  return transformers.has(transformerKey(source, target));
}

// ─── Register Built-in Transformers ──────────────────────────

import { ChatGPTToClaudeTransformer } from './chatgpt-to-claude.js';
import { ClaudeToChatGPTTransformer } from './claude-to-chatgpt.js';

// ChatGPT → Claude transformer
registerTransformer('chatgpt', 'claude', () => new ChatGPTToClaudeTransformer());

// Claude → ChatGPT transformer
registerTransformer('claude', 'chatgpt', () => new ClaudeToChatGPTTransformer());
