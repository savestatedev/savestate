/**
 * QualityGate Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  QualityGate, 
  QualityMetric, 
  QualityGateConfig,
  QualityResult
} from '../index.js';

describe('QualityGate', () => {
  let gate: QualityGate;

  beforeEach(() => {
    gate = new QualityGate();
  });

  describe('evaluateContext', () => {
    it('should evaluate context with query', () => {
      const content = 'The user prefers dark mode for their IDE settings.';
      const result = gate.evaluateContext(content, 'dark mode preferences');
      
      expect(result.scores).toHaveLength(4);
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should evaluate context with expected topics', () => {
      const content = 'Dark mode is preferred. The font size should be 14px.';
      const result = gate.evaluateContext(content, undefined, ['dark mode', 'font size']);
      
      const completeness = result.scores.find(s => s.metric === QualityMetric.COMPLETENESS);
      expect(completeness?.score).toBe(1);
    });

    it('should return coherence score based on structure', () => {
      const structured = 'This is sentence one. This is sentence two.\n\nThis is a new paragraph.';
      const unstructured = 'word';
      
      const structuredResult = gate.evaluateContext(structured);
      const unstructuredResult = gate.evaluateContext(unstructured);
      
      expect(structuredResult.scores.find(s => s.metric === QualityMetric.COHERENCE)?.score)
        .toBeGreaterThan(unstructuredResult.scores.find(s => s.metric === QualityMetric.COHERENCE)?.score ?? 0);
    });

    it('should handle empty content', () => {
      const result = gate.evaluateContext('', 'test query');
      
      expect(result.scores).toHaveLength(4);
      expect(result.overallScore).toBeLessThan(0.5);
    });
  });

  describe('compare', () => {
    it('should detect quality regression', () => {
      const fullContext = 'User prefers dark mode. User prefers large font. User prefers terminal vim.';
      const packetContext = 'User prefers dark mode.';
      
      const result = gate.compare(fullContext, packetContext, 'user preferences');
      
      expect(result.overallRegression).toBeGreaterThan(0);
      expect(result.deltas.length).toBe(4);
    });

    it('should pass when quality is acceptable', () => {
      const fullContext = 'This is important context about the user project.';
      const packetContext = 'This is important context about the user project.';
      
      const result = gate.compare(fullContext, packetContext);
      
      expect(result.regressionExceedsThreshold).toBe(false);
    });

    it('should generate recommendations', () => {
      const fullContext = 'Important detail one. Important detail two. Important detail three.';
      const packetContext = 'Important detail one.';
      
      const result = gate.compare(fullContext, packetContext);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should include all metrics in deltas', () => {
      const result = gate.compare('Full content', 'Packet content');
      
      const metrics = result.deltas.map(d => d.metric);
      expect(metrics).toContain(QualityMetric.RELEVANCE);
      expect(metrics).toContain(QualityMetric.COMPLETENESS);
      expect(metrics).toContain(QualityMetric.ACCURACY);
      expect(metrics).toContain(QualityMetric.COHERENCE);
    });

    it('should have unique comparison IDs', () => {
      const result1 = gate.compare('A', 'B');
      const result2 = gate.compare('A', 'B');
      
      expect(result1.comparison_id).not.toBe(result2.comparison_id);
    });
  });

  describe('configuration', () => {
    it('should use default config', () => {
      const config = gate.getConfig();
      
      expect(config.regressionThreshold).toBe(0.02);
      expect(config.shadowMode).toBe(true);
      expect(config.sampleRate).toBe(0.1);
    });

    it('should accept custom config', () => {
      const customGate = new QualityGate({
        regressionThreshold: 0.05,
        shadowMode: false,
        sampleRate: 0.5,
      });
      
      const config = customGate.getConfig();
      
      expect(config.regressionThreshold).toBe(0.05);
      expect(config.shadowMode).toBe(false);
      expect(config.sampleRate).toBe(0.5);
    });

    it('should update config', () => {
      gate.updateConfig({ sampleRate: 0.25 });
      
      const config = gate.getConfig();
      expect(config.sampleRate).toBe(0.25);
    });
  });

  describe('shouldEvaluate', () => {
    it('should sometimes return true based on sample rate', () => {
      const customGate = new QualityGate({ sampleRate: 1.0 });
      
      // With 100% sample rate, should always evaluate
      let evaluated = false;
      for (let i = 0; i < 10; i++) {
        if (customGate.shouldEvaluate()) {
          evaluated = true;
          break;
        }
      }
      expect(evaluated).toBe(true);
    });

    it('should rarely evaluate with low sample rate', () => {
      const customGate = new QualityGate({ sampleRate: 0.0 });
      
      expect(customGate.shouldEvaluate()).toBe(false);
    });
  });
});
