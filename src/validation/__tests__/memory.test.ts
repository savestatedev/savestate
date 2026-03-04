import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEMORY_VALIDATION_CONFIG,
  canonicalizeSourceType,
  computeConfidenceScore,
  detectContentFormat,
  validateMemoryEntry,
} from '../index.js';

describe('memory validation', () => {
  describe('detectContentFormat', () => {
    it('detects json content', () => {
      expect(detectContentFormat('{"ok":true}')).toBe('json');
    });

    it('detects html content', () => {
      expect(detectContentFormat('<html><body>text</body></html>')).toBe('html');
    });

    it('detects markdown content', () => {
      expect(detectContentFormat('# Heading\n- one')).toBe('markdown');
    });
  });

  describe('canonicalizeSourceType', () => {
    it('maps legacy external to web_scrape', () => {
      expect(canonicalizeSourceType('external')).toBe('web_scrape');
    });

    it('maps agent_inference to system', () => {
      expect(canonicalizeSourceType('agent_inference')).toBe('system');
    });
  });

  describe('computeConfidenceScore', () => {
    it('scores user input higher than suspicious web scrape', () => {
      const trusted = computeConfidenceScore('user_input', 'User prefers dark mode in settings');
      const suspicious = computeConfidenceScore('web_scrape', 'A'.repeat(220) + ' spam '.repeat(200));

      expect(trusted.confidenceScore).toBeGreaterThan(suspicious.confidenceScore);
      expect(suspicious.anomalyFlags.length).toBeGreaterThan(0);
    });
  });

  describe('validateMemoryEntry', () => {
    it('rejects null bytes and control chars', () => {
      const result = validateMemoryEntry({
        content: 'hello\u0000world',
        sourceType: 'tool_output',
        sourceId: 'terminal',
      });

      expect(result.accepted).toBe(false);
      expect(result.rejectionReason).toContain('encoding artifacts');
    });

    it('rejects invalid json for tool output', () => {
      const result = validateMemoryEntry({
        content: '{"status":',
        sourceType: 'tool_output',
        sourceId: 'tool-1',
        declaredContentType: 'json',
      });

      expect(result.accepted).toBe(false);
      expect(result.rejectionReason).toContain('Invalid JSON');
    });

    it('validates structured json for tool output', () => {
      const result = validateMemoryEntry({
        content: '{"status":"ok","items":[1,2,3]}',
        sourceType: 'tool_output',
        sourceId: 'tool-2',
        declaredContentType: 'json',
      });

      expect(result.accepted).toBe(true);
      expect(result.normalizedContentType).toBe('json');
      expect(result.validationNotes).toContain('Structured output schema validated');
    });

    it('sanitizes html from web_scrape entries', () => {
      const result = validateMemoryEntry({
        content: '<html><body><script>alert(1)</script><p>Visible text</p></body></html>',
        sourceType: 'web_scrape',
        sourceId: 'https://example.com',
      });

      expect(result.accepted).toBe(true);
      expect(result.normalizedContent).toBe('Visible text');
      expect(result.detectedFormat).toBe('html');
      expect(result.normalizedContentType).toBe('text');
    });

    it('truncates oversized non-json content', () => {
      const result = validateMemoryEntry({
        content: 'x'.repeat(DEFAULT_MEMORY_VALIDATION_CONFIG.maxEntryLength + 100),
        sourceType: 'tool_output',
        sourceId: 'terminal',
      });

      expect(result.accepted).toBe(true);
      expect(result.normalizedContent.length).toBe(DEFAULT_MEMORY_VALIDATION_CONFIG.maxEntryLength);
      expect(result.validationNotes.some(note => note.includes('truncated'))).toBe(true);
    });

    it('marks suspicious content for quarantine', () => {
      const result = validateMemoryEntry({
        content: 'A'.repeat(220) + ' spam '.repeat(200),
        sourceType: 'web_scrape',
        sourceId: 'https://bad.example',
      });

      expect(result.accepted).toBe(true);
      expect(result.quarantined).toBe(true);
      expect(result.confidenceScore).toBeLessThan(DEFAULT_MEMORY_VALIDATION_CONFIG.quarantineThreshold);
    });
  });
});
