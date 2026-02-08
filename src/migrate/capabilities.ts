/**
 * Platform Capabilities
 *
 * Defines what each platform supports for compatibility checking.
 */

import type { Platform, PlatformCapabilities } from './types.js';

export const PLATFORM_CAPABILITIES: Record<Platform, PlatformCapabilities> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    instructionLimit: 1500,
    hasMemory: true,
    memoryLimit: 100,
    hasFiles: true,
    fileSizeLimit: 512 * 1024 * 1024, // 512MB
    hasProjects: false,
    hasConversations: true,
    hasCustomBots: true,
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    instructionLimit: 8000, // System prompt can be much longer
    hasMemory: false, // Claude uses project knowledge instead
    hasFiles: true,
    fileSizeLimit: 32 * 1024 * 1024, // 32MB per file
    hasProjects: true,
    hasConversations: true,
    hasCustomBots: false, // Projects serve this role
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    instructionLimit: 4000,
    hasMemory: true,
    memoryLimit: 50,
    hasFiles: true,
    fileSizeLimit: 20 * 1024 * 1024, // 20MB
    hasProjects: false,
    hasConversations: true,
    hasCustomBots: false,
  },
  copilot: {
    id: 'copilot',
    name: 'Microsoft Copilot',
    instructionLimit: 2000,
    hasMemory: true,
    hasFiles: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    hasProjects: false,
    hasConversations: true,
    hasCustomBots: false,
  },
};

/**
 * Get capabilities for a platform.
 */
export function getPlatformCapabilities(platform: Platform): PlatformCapabilities {
  return PLATFORM_CAPABILITIES[platform];
}

/**
 * Check if a migration path is supported.
 */
export function isMigrationSupported(source: Platform, target: Platform): boolean {
  // Currently supported paths
  const supported = [
    ['chatgpt', 'claude'],
    ['claude', 'chatgpt'],
  ];
  
  return supported.some(([s, t]) => s === source && t === target);
}

/**
 * Get all supported migration paths.
 */
export function getSupportedMigrations(): Array<{ source: Platform; target: Platform }> {
  return [
    { source: 'chatgpt', target: 'claude' },
    { source: 'claude', target: 'chatgpt' },
  ];
}
