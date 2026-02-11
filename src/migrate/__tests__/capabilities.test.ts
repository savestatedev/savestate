/**
 * Platform Capabilities Tests
 *
 * Tests for platform capability definitions and migration support checks.
 */

import { describe, it, expect } from 'vitest';
import {
  getPlatformCapabilities,
  isMigrationSupported,
  getSupportedMigrations,
  PLATFORM_CAPABILITIES,
} from '../capabilities.js';

describe('Platform Capabilities', () => {
  describe('getPlatformCapabilities', () => {
    it('should return capabilities for ChatGPT', () => {
      const caps = getPlatformCapabilities('chatgpt');
      expect(caps.id).toBe('chatgpt');
      expect(caps.name).toBe('ChatGPT');
      expect(caps.instructionLimit).toBe(1500);
      expect(caps.hasMemory).toBe(true);
      expect(caps.memoryLimit).toBe(100);
      expect(caps.hasCustomBots).toBe(true);
    });

    it('should return capabilities for Claude', () => {
      const caps = getPlatformCapabilities('claude');
      expect(caps.id).toBe('claude');
      expect(caps.name).toBe('Claude');
      expect(caps.instructionLimit).toBe(8000);
      expect(caps.hasMemory).toBe(false);
      expect(caps.hasProjects).toBe(true);
    });

    it('should return capabilities for Gemini', () => {
      const caps = getPlatformCapabilities('gemini');
      expect(caps.id).toBe('gemini');
      expect(caps.name).toBe('Gemini');
      expect(caps.instructionLimit).toBe(4000);
      expect(caps.hasMemory).toBe(true);
    });

    it('should return capabilities for Copilot', () => {
      const caps = getPlatformCapabilities('copilot');
      expect(caps.id).toBe('copilot');
      expect(caps.name).toBe('Microsoft Copilot');
      expect(caps.instructionLimit).toBe(2000);
    });
  });

  describe('isMigrationSupported', () => {
    it('should return true for ChatGPT to Claude', () => {
      expect(isMigrationSupported('chatgpt', 'claude')).toBe(true);
    });

    it('should return true for Claude to ChatGPT', () => {
      expect(isMigrationSupported('claude', 'chatgpt')).toBe(true);
    });

    it('should return false for unsupported paths', () => {
      expect(isMigrationSupported('gemini', 'claude')).toBe(false);
      expect(isMigrationSupported('chatgpt', 'gemini')).toBe(false);
      expect(isMigrationSupported('copilot', 'chatgpt')).toBe(false);
    });

    it('should return false for same platform migration', () => {
      expect(isMigrationSupported('chatgpt', 'chatgpt')).toBe(false);
      expect(isMigrationSupported('claude', 'claude')).toBe(false);
    });
  });

  describe('getSupportedMigrations', () => {
    it('should return all supported migration paths', () => {
      const paths = getSupportedMigrations();
      expect(paths).toHaveLength(2);
      expect(paths).toContainEqual({ source: 'chatgpt', target: 'claude' });
      expect(paths).toContainEqual({ source: 'claude', target: 'chatgpt' });
    });
  });

  describe('PLATFORM_CAPABILITIES', () => {
    it('should have all platforms defined', () => {
      expect(PLATFORM_CAPABILITIES).toHaveProperty('chatgpt');
      expect(PLATFORM_CAPABILITIES).toHaveProperty('claude');
      expect(PLATFORM_CAPABILITIES).toHaveProperty('gemini');
      expect(PLATFORM_CAPABILITIES).toHaveProperty('copilot');
    });

    it('should have valid file size limits', () => {
      for (const platform of Object.keys(PLATFORM_CAPABILITIES) as Array<keyof typeof PLATFORM_CAPABILITIES>) {
        const caps = PLATFORM_CAPABILITIES[platform];
        if (caps.hasFiles) {
          expect(caps.fileSizeLimit).toBeDefined();
          expect(caps.fileSizeLimit).toBeGreaterThan(0);
        }
      }
    });

    it('should have valid instruction limits', () => {
      for (const platform of Object.keys(PLATFORM_CAPABILITIES) as Array<keyof typeof PLATFORM_CAPABILITIES>) {
        const caps = PLATFORM_CAPABILITIES[platform];
        expect(caps.instructionLimit).toBeGreaterThan(0);
      }
    });
  });
});
