/**
 * Loader Registry
 *
 * Manages available loaders for different platforms.
 * New loaders are registered here.
 */

import type { Platform, Loader } from '../types.js';

const loaders = new Map<Platform, () => Loader>();

/**
 * Register a loader for a platform.
 */
export function registerLoader(platform: Platform, factory: () => Loader): void {
  loaders.set(platform, factory);
}

/**
 * Get a loader for a platform.
 */
export function getLoader(platform: Platform): Loader | null {
  const factory = loaders.get(platform);
  return factory ? factory() : null;
}

/**
 * List all registered loaders.
 */
export function listLoaders(): Platform[] {
  return [...loaders.keys()];
}

/**
 * Check if a loader exists for a platform.
 */
export function hasLoader(platform: Platform): boolean {
  return loaders.has(platform);
}

// ─── Register Built-in Loaders ───────────────────────────────

import { ClaudeLoader } from './claude.js';
import { ChatGPTLoader } from './chatgpt.js';

// Claude loader (#25)
registerLoader('claude', () => new ClaudeLoader());

// ChatGPT loader (#30)
registerLoader('chatgpt', () => new ChatGPTLoader());
