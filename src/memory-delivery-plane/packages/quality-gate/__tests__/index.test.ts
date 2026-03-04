/**
 * Quality Gate Tests
 */

import { describe, it, expect } from 'vitest';
import { QualityGate, type QualityMetrics, type ComparisonResult } from '../index.js';

describe('QualityGate', () => {
  describe('compare', () => {
    it('should pass when regression is within threshold', () => {
      const gate = new QualityGate({ maxRegression: 50 });
      
      const result = gate.compare(
        'The project uses TypeScript and React for the frontend, with Node.js backend.',
        'The project uses TypeScript and React for the frontend.',
        ['TypeScript', 'React']
      );
      
      expect(result.passed).toBe(true);
      expect(result.regression).toBeLessThanOrEqual(50);
    });

    it('should fail when regression exceeds threshold', () => {
      const gate = new QualityGate({ maxRegression: 1 });
      
      const result = gate.compare(
        'TypeScript React Node.js Python Go Rust Docker Kubernetes',
        'TypeScript',
        ['TypeScript', 'React', 'Node.js', 'Python', 'Go', 'Rust', 'Docker', 'Kubernetes']
      );
      
      expect(result.passed).toBe(false);
    });

    it('should calculate correct similarity score', () => {
      const gate = new QualityGate();
      
      const result = gate.compare(
        'This is about TypeScript and JavaScript programming',
        'This mentions TypeScript and JavaScript',
        ['TypeScript', 'JavaScript']
      );
      
      // Both mention the key topics
      expect(result.packetContextMetrics.similarity).toBeGreaterThan(0.5);
    });

    it('should handle empty key info', () => {
      const gate = new QualityGate();
      
      const result = gate.compare(
        'Some response text',
        'Some response text',
        []
      );
      
      // Empty key info should still produce valid results (based on coherence)
      expect(result.fullContextMetrics.overall).toBeGreaterThan(0);
      expect(result.packetContextMetrics.overall).toBeGreaterThan(0);
      // Same response = 0 regression
      expect(result.regression).toBe(0);
    });

    it('should detect key information retention', () => {
      const gate = new QualityGate();
      
      const keyInfo = [
        'authentication',
        'authorization', 
        'JWT tokens',
        'OAuth2',
        'session management'
      ];
      
      const fullResult = 'The system uses OAuth2 for authentication and JWT tokens for authorization with session management.';
      const packetResult = 'The system uses OAuth2 for authentication.';
      
      const result = gate.compare(fullResult, packetResult, keyInfo);
      
      // Full context should retain all key info
      expect(result.fullContextMetrics.retention).toBe(1);
      // Packet context should retain partial
      expect(result.packetContextMetrics.retention).toBeLessThan(1);
    });

    it('should calculate coherence', () => {
      const gate = new QualityGate();
      
      // Good response with structure
      const goodResponse = `
This is a well-structured response.
1. First point
2. Second point
3. Third point

It has multiple sentences.
      `;
      
      // Poor response
      const poorResponse = 'a';
      
      const goodResult = gate.compare(goodResponse, goodResponse, []);
      const poorResult = gate.compare(poorResponse, poorResponse, []);
      
      expect(goodResult.fullContextMetrics.coherence).toBeGreaterThan(poorResult.fullContextMetrics.coherence);
    });
  });

  describe('shadowCompare', () => {
    it('should run both request types in parallel', async () => {
      const gate = new QualityGate();
      
      let fullCalled = false;
      let packetCalled = false;
      
      const fullFn = async () => {
        fullCalled = true;
        await Promise.resolve(); // Simulate async
        return 'Full context response about TypeScript and React';
      };
      
      const packetFn = async () => {
        packetCalled = true;
        await Promise.resolve();
        return 'Packet context response about TypeScript';
      };
      
      await gate.shadowCompare(fullFn, packetFn, ['TypeScript', 'React']);
      
      expect(fullCalled).toBe(true);
      expect(packetCalled).toBe(true);
    });
  });

  describe('evaluateBatch', () => {
    it('should evaluate multiple comparisons', () => {
      const gate = new QualityGate({ maxRegression: 10 });
      
      const comparisons = [
        {
          fullResult: 'TypeScript React Node',
          packetResult: 'TypeScript React',
          keyInfo: ['TypeScript', 'React', 'Node'],
        },
        {
          fullResult: 'Python Go Rust',
          packetResult: 'Python Go',
          keyInfo: ['Python', 'Go', 'Rust'],
        },
        {
          fullResult: 'Docker Kubernetes',
          packetResult: 'Docker',
          keyInfo: ['Docker', 'Kubernetes'],
        },
      ];
      
      const batchResult = gate.evaluateBatch(comparisons);
      
      expect(batchResult.total).toBe(3);
      expect(batchResult.results.length).toBe(3);
      expect(batchResult.avgRegression).toBeGreaterThan(0);
    });

    it('should count passed and failed correctly', () => {
      const gate = new QualityGate({ maxRegression: 30 });
      
      const comparisons = [
        {
          fullResult: 'TypeScript React Node Python Go',
          packetResult: 'TypeScript React Node', // small loss
          keyInfo: ['TypeScript', 'React', 'Node', 'Python', 'Go'],
        },
        {
          fullResult: 'ABC DEF GHI JKL MNO',
          packetResult: 'ABC', // big loss
          keyInfo: ['ABC', 'DEF', 'GHI', 'JKL', 'MNO'],
        },
      ];
      
      const batchResult = gate.evaluateBatch(comparisons);
      
      // First should pass (small loss), second should fail (big loss)
      expect(batchResult.passed).toBe(1);
      expect(batchResult.failed).toBe(1);
    });
  });

  describe('generateReport', () => {
    it('should generate a readable report', () => {
      const gate = new QualityGate({ maxRegression: 5 });
      
      const result: ComparisonResult = {
        timestamp: '2026-03-04T00:00:00Z',
        fullContextMetrics: {
          similarity: 0.95,
          retention: 0.90,
          coherence: 0.85,
          overall: 0.90,
        },
        packetContextMetrics: {
          similarity: 0.80,
          retention: 0.75,
          coherence: 0.85,
          overall: 0.80,
        },
        regression: 11.11,
        passed: false,
        details: {
          topicsCovered: 3,
          totalTopics: 5,
          keyInfoRetained: 3,
          totalKeyInfo: 5,
        },
      };
      
      const report = gate.generateReport(result);
      
      expect(report).toContain('❌ FAILED');
      expect(report).toContain('11.11%');
      expect(report).toContain('5%');
    });

    it('should show passed status for good results', () => {
      const gate = new QualityGate({ maxRegression: 10 });
      
      const result: ComparisonResult = {
        timestamp: '2026-03-04T00:00:00Z',
        fullContextMetrics: {
          similarity: 0.95,
          retention: 0.90,
          coherence: 0.85,
          overall: 0.90,
        },
        packetContextMetrics: {
          similarity: 0.88,
          retention: 0.85,
          coherence: 0.85,
          overall: 0.86,
        },
        regression: 4.44,
        passed: true,
        details: {
          topicsCovered: 4,
          totalTopics: 5,
          keyInfoRetained: 4,
          totalKeyInfo: 5,
        },
      };
      
      const report = gate.generateReport(result);
      
      expect(report).toContain('✅ PASSED');
      expect(report).toContain('4.44%');
    });
  });

  describe('quality thresholds', () => {
    it('should use custom max regression threshold', () => {
      const lenientGate = new QualityGate({ maxRegression: 80 });
      const strictGate = new QualityGate({ maxRegression: 5 });
      
      const full = 'TypeScript React Node Python Go Rust Docker Kubernetes';
      const packet = 'TypeScript React'; // losing a lot
      
      const lenientResult = lenientGate.compare(full, packet, 
        ['TypeScript', 'React', 'Node', 'Python', 'Go', 'Rust', 'Docker', 'Kubernetes']);
      const strictResult = strictGate.compare(full, packet, 
        ['TypeScript', 'React', 'Node', 'Python', 'Go', 'Rust', 'Docker', 'Kubernetes']);
      
      // With 80% threshold, lenient should pass
      expect(lenientResult.passed).toBe(true);
      // With 5% threshold, strict should fail (big loss)
      expect(strictResult.passed).toBe(false);
    });
  });
});
