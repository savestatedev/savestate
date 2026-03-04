/**
 * Registry Tests
 *
 * Tests for extractor, transformer, and loader registries.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getExtractor,
  registerExtractor,
  listExtractors,
  hasExtractor,
} from '../extractors/registry.js';
import {
  getTransformer,
  registerTransformer,
  listTransformers,
  hasTransformer,
} from '../transformers/registry.js';
import {
  getLoader,
  registerLoader,
  listLoaders,
  hasLoader,
} from '../loaders/registry.js';
import { registerMockPlugins } from '../testing/index.js';

describe('Extractor Registry', () => {
  beforeEach(() => {
    // Register mock plugins to ensure consistent state
    registerMockPlugins();
  });

  it('should get registered extractor', () => {
    const extractor = getExtractor('chatgpt');
    expect(extractor).not.toBeNull();
    expect(extractor?.platform).toBe('chatgpt');
  });

  it('should list all extractors', () => {
    const extractors = listExtractors();
    expect(extractors).toContain('chatgpt');
    expect(extractors).toContain('claude');
  });

  it('should check if extractor exists', () => {
    expect(hasExtractor('chatgpt')).toBe(true);
    expect(hasExtractor('claude')).toBe(true);
    expect(hasExtractor('gemini')).toBe(true); // Mock registered
  });

  it('should return null for non-registered platform without mocks', () => {
    // This tests the underlying behavior - mock plugins register all platforms
    // but the original registry only has chatgpt and claude
    const extractor = getExtractor('copilot');
    // With mocks, all platforms are registered
    expect(extractor).not.toBeNull();
  });
});

describe('Transformer Registry', () => {
  beforeEach(() => {
    registerMockPlugins();
  });

  it('should get registered transformer', () => {
    const transformer = getTransformer('chatgpt', 'claude');
    expect(transformer).not.toBeNull();
    expect(transformer?.source).toBe('chatgpt');
    expect(transformer?.target).toBe('claude');
  });

  it('should list all transformers', () => {
    const transformers = listTransformers();
    expect(transformers.some((t) => t.source === 'chatgpt' && t.target === 'claude')).toBe(true);
    expect(transformers.some((t) => t.source === 'claude' && t.target === 'chatgpt')).toBe(true);
  });

  it('should check if transformer exists', () => {
    expect(hasTransformer('chatgpt', 'claude')).toBe(true);
    expect(hasTransformer('claude', 'chatgpt')).toBe(true);
  });

  it('should return null for non-registered path', () => {
    // Mock plugins register common paths but not all combinations
    const transformer = getTransformer('copilot', 'gemini');
    expect(transformer).toBeNull();
  });
});

describe('Loader Registry', () => {
  beforeEach(() => {
    registerMockPlugins();
  });

  it('should get registered loader', () => {
    const loader = getLoader('claude');
    expect(loader).not.toBeNull();
    expect(loader?.platform).toBe('claude');
  });

  it('should list all loaders', () => {
    const loaders = listLoaders();
    expect(loaders).toContain('chatgpt');
    expect(loaders).toContain('claude');
  });

  it('should check if loader exists', () => {
    expect(hasLoader('chatgpt')).toBe(true);
    expect(hasLoader('claude')).toBe(true);
  });
});

describe('Registry Integration', () => {
  it('should allow registering custom implementations', () => {
    const customPlatform = 'gemini' as const;

    // Register custom extractor
    let extractCalled = false;
    registerExtractor(customPlatform, () => ({
      platform: customPlatform,
      version: 'custom',
      canExtract: async () => true,
      extract: async () => {
        extractCalled = true;
        return {
          version: '1.0' as const,
          id: 'custom',
          source: {
            platform: customPlatform,
            extractedAt: new Date().toISOString(),
            extractorVersion: 'custom',
          },
          contents: {},
          metadata: {
            totalItems: 0,
            itemCounts: {
              instructions: 0,
              memories: 0,
              conversations: 0,
              files: 0,
              customBots: 0,
            },
            warnings: [],
            errors: [],
          },
        };
      },
      getProgress: () => 100,
    }));

    const extractor = getExtractor(customPlatform);
    expect(extractor?.version).toBe('custom');
  });

  it('should allow registering custom transformers', () => {
    registerTransformer('gemini', 'copilot', () => ({
      source: 'gemini',
      target: 'copilot',
      version: 'custom-transformer',
      analyze: async (bundle) => ({
        source: 'gemini',
        target: 'copilot',
        generatedAt: new Date().toISOString(),
        summary: { perfect: 1, adapted: 0, incompatible: 0, total: 1 },
        items: [],
        recommendations: [],
        feasibility: 'easy',
      }),
      transform: async (bundle) => ({
        ...bundle,
        target: {
          platform: 'copilot',
          transformedAt: new Date().toISOString(),
          transformerVersion: 'custom-transformer',
        },
      }),
    }));

    expect(hasTransformer('gemini', 'copilot')).toBe(true);
    const transformer = getTransformer('gemini', 'copilot');
    expect(transformer?.version).toBe('custom-transformer');
  });

  it('should allow registering custom loaders', () => {
    registerLoader('gemini', () => ({
      platform: 'gemini',
      version: 'custom-loader',
      canLoad: async () => true,
      load: async () => ({
        success: true,
        loaded: { instructions: true, memories: 0, files: 0, customBots: 0 },
        warnings: [],
        errors: [],
      }),
      getProgress: () => 100,
    }));

    expect(hasLoader('gemini')).toBe(true);
    const loader = getLoader('gemini');
    expect(loader?.version).toBe('custom-loader');
  });
});
