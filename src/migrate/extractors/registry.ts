/**
 * Extractor Registry
 *
 * Manages available extractors for different platforms.
 * New extractors are registered here.
 */

import type { Platform, Extractor } from '../types.js';

const extractors = new Map<Platform, () => Extractor>();

/**
 * Register an extractor for a platform.
 */
export function registerExtractor(platform: Platform, factory: () => Extractor): void {
  extractors.set(platform, factory);
}

/**
 * Get an extractor for a platform.
 */
export function getExtractor(platform: Platform): Extractor | null {
  const factory = extractors.get(platform);
  return factory ? factory() : null;
}

/**
 * List all registered extractors.
 */
export function listExtractors(): Platform[] {
  return [...extractors.keys()];
}

/**
 * Check if an extractor exists for a platform.
 */
export function hasExtractor(platform: Platform): boolean {
  return extractors.has(platform);
}

// ─── Register Built-in Extractors ────────────────────────────

// ChatGPT extractor will be registered in #24
// registerExtractor('chatgpt', () => new ChatGPTExtractor());

// Claude extractor will be registered in #29
// registerExtractor('claude', () => new ClaudeExtractor());
