/**
 * Memory Delivery Plane - Quality Gate
 * 
 * Shadow mode to compare full-context vs packet-context quality.
 */

import type { TaskPacket } from '../packet-builder/index.js';
import type { RoutingResult } from '../packet-router/index.js';

/**
 * Quality metrics for comparison
 */
export interface QualityMetrics {
  /** Semantic similarity score (0-1) */
  similarity: number;
  /** Key information retention score (0-1) */
  retention: number;
  /** Response coherence score (0-1) */
  coherence: number;
  /** Overall quality score (0-1) */
  overall: number;
}

/**
 * Comparison result between full and packet context
 */
export interface ComparisonResult {
  timestamp: string;
  fullContextMetrics: QualityMetrics;
  packetContextMetrics: QualityMetrics;
  regression: number; // percentage (0-100)
  passed: boolean;
  details: {
    topicsCovered: number;
    totalTopics: number;
    keyInfoRetained: number;
    totalKeyInfo: number;
  };
}

/**
 * Quality Gate configuration
 */
export interface QualityGateOptions {
  /** Maximum allowed regression percentage */
  maxRegression?: number;
  /** Enable automatic similarity scoring */
  autoSimilarity?: boolean;
  /** Number of key topics to track */
  keyTopicCount?: number;
}

/**
 * Quality Gate - evaluates packet-based context quality vs full context
 * 
 * Runs requests in shadow mode and compares results.
 */
export class QualityGate {
  private maxRegression: number;
  private autoSimilarity: boolean;
  private keyTopicCount: number;

  constructor(options?: QualityGateOptions) {
    this.maxRegression = options?.maxRegression ?? 1; // 1% default
    this.autoSimilarity = options?.autoSimilarity ?? true;
    this.keyTopicCount = options?.keyTopicCount ?? 5;
  }

  /**
   * Compare full context vs packet context results
   * @param fullContextResult - Result from full context request
   * @param packetContextResult - Result from packet context request
   * @param fullContextKeyInfo - Key information from full context (for retention check)
   * @returns Comparison result with regression metrics
   */
  compare(
    fullContextResult: string,
    packetContextResult: string,
    fullContextKeyInfo: string[]
  ): ComparisonResult {
    const timestamp = new Date().toISOString();

    // Calculate metrics for both
    const fullMetrics = this.calculateMetrics(fullContextResult, fullContextKeyInfo);
    const packetMetrics = this.calculateMetrics(packetContextResult, fullContextKeyInfo);

    // Calculate regression
    const regression = ((fullMetrics.overall - packetMetrics.overall) / fullMetrics.overall) * 100;

    // Determine if quality gate passed
    const passed = regression <= this.maxRegression;

    return {
      timestamp,
      fullContextMetrics: fullMetrics,
      packetContextMetrics: packetMetrics,
      regression: Math.round(regression * 100) / 100,
      passed,
      details: {
        topicsCovered: this.countTopicsCovered(packetContextResult, fullContextKeyInfo),
        totalTopics: fullContextKeyInfo.length,
        keyInfoRetained: this.countKeyInfoRetained(packetContextResult, fullContextKeyInfo),
        totalKeyInfo: fullContextKeyInfo.length,
      },
    };
  }

  /**
   * Calculate quality metrics for a response
   */
  private calculateMetrics(response: string, keyInfo: string[]): QualityMetrics {
    // Similarity: based on keyword overlap with key info
    const similarity = this.calculateSimilarity(response, keyInfo);

    // Retention: how much key info is present in response
    const retention = this.calculateRetention(response, keyInfo);

    // Coherence: simple heuristic based on response structure
    const coherence = this.calculateCoherence(response);

    // Overall: weighted average
    const overall = (similarity * 0.4) + (retention * 0.4) + (coherence * 0.2);

    return {
      similarity: Math.round(similarity * 1000) / 1000,
      retention: Math.round(retention * 1000) / 1000,
      coherence: Math.round(coherence * 1000) / 1000,
      overall: Math.round(overall * 1000) / 1000,
    };
  }

  /**
   * Calculate semantic similarity score
   */
  private calculateSimilarity(response: string, keyInfo: string[]): number {
    if (keyInfo.length === 0) return 1;

    const responseLower = response.toLowerCase();
    const responseWords = new Set(responseLower.split(/\s+/).filter(w => w.length > 2));

    let matches = 0;
    for (const info of keyInfo) {
      const infoWords = info.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      for (const word of infoWords) {
        if (responseWords.has(word)) {
          matches++;
          break;
        }
      }
    }

    return matches / keyInfo.length;
  }

  /**
   * Calculate information retention score
   */
  private calculateRetention(response: string, keyInfo: string[]): number {
    if (keyInfo.length === 0) return 1;

    const responseLower = response.toLowerCase();
    let retained = 0;

    for (const info of keyInfo) {
      // Check if key phrase/word is in response
      const infoLower = info.toLowerCase();
      if (responseLower.includes(infoLower) || 
          infoLower.split(/\s+/).some(w => w.length > 3 && responseLower.includes(w))) {
        retained++;
      }
    }

    return retained / keyInfo.length;
  }

  /**
   * Calculate coherence score (heuristic)
   */
  private calculateCoherence(response: string): number {
    // Basic checks for coherent response
    if (!response || response.length < 10) return 0;

    // Check for minimum length
    const lengthScore = Math.min(1, response.length / 100);

    // Check for proper sentences (has periods, question marks, etc.)
    const hasSentences = /[.!?]/.test(response);
    const sentenceScore = hasSentences ? 1 : 0.5;

    // Check for structured content (lists, code blocks, etc.)
    const hasStructure = /(\n|[-*•]|```|\d+\.)/.test(response) ? 1 : 0.7;

    return (lengthScore * 0.3) + (sentenceScore * 0.3) + (hasStructure * 0.4);
  }

  /**
   * Count how many topics are covered in the response
   */
  private countTopicsCovered(response: string, topics: string[]): number {
    if (topics.length === 0) return 0;

    const responseLower = response.toLowerCase();
    let covered = 0;

    for (const topic of topics) {
      if (responseLower.includes(topic.toLowerCase())) {
        covered++;
      }
    }

    return covered;
  }

  /**
   * Count how much key information is retained
   */
  private countKeyInfoRetained(response: string, keyInfo: string[]): number {
    return this.countTopicsCovered(response, keyInfo);
  }

  /**
   * Run a shadow comparison
   * 
   * @param requestFn - Function to execute request (returns response)
   * @param routerFn - Function to get packet-based context
   * @param keyInfo - Key information to track
   * @returns Comparison result
   */
  async shadowCompare(
    requestFn: () => Promise<string>,
    routerFn: () => Promise<string>,
    keyInfo: string[]
  ): Promise<ComparisonResult> {
    // Execute both in parallel
    const [fullResult, packetResult] = await Promise.all([
      requestFn(),
      routerFn(),
    ]);

    return this.compare(fullResult, packetResult, keyInfo);
  }

  /**
   * Batch evaluate multiple comparisons
   * 
   * @param comparisons - Array of comparison inputs
   * @returns Summary statistics
   */
  evaluateBatch(
    comparisons: Array<{
      fullResult: string;
      packetResult: string;
      keyInfo: string[];
    }>
  ): {
    total: number;
    passed: number;
    failed: number;
    avgRegression: number;
    results: ComparisonResult[];
  } {
    const results: ComparisonResult[] = [];
    let totalRegression = 0;

    for (const comp of comparisons) {
      const result = this.compare(comp.fullResult, comp.packetResult, comp.keyInfo);
      results.push(result);
      totalRegression += result.regression;
    }

    const passed = results.filter(r => r.passed).length;

    return {
      total: comparisons.length,
      passed,
      failed: comparisons.length - passed,
      avgRegression: Math.round((totalRegression / comparisons.length) * 100) / 100,
      results,
    };
  }

  /**
   * Generate a quality report
   */
  generateReport(result: ComparisonResult): string {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    
    return `
## Quality Gate Report
**Status:** ${status}
**Regression:** ${result.regression}%
**Threshold:** ${this.maxRegression}%

### Full Context Metrics
- Similarity: ${(result.fullContextMetrics.similarity * 100).toFixed(1)}%
- Retention: ${(result.fullContextMetrics.retention * 100).toFixed(1)}%
- Coherence: ${(result.fullContextMetrics.coherence * 100).toFixed(1)}%
- Overall: ${(result.fullContextMetrics.overall * 100).toFixed(1)}%

### Packet Context Metrics
- Similarity: ${(result.packetContextMetrics.similarity * 100).toFixed(1)}%
- Retention: ${(result.packetContextMetrics.retention * 100).toFixed(1)}%
- Coherence: ${(result.packetContextMetrics.coherence * 100).toFixed(1)}%
- Overall: ${(result.packetContextMetrics.overall * 100).toFixed(1)}%

### Details
- Topics Covered: ${result.details.topicsCovered}/${result.details.totalTopics}
- Key Info Retained: ${result.details.keyInfoRetained}/${result.details.totalKeyInfo}
`;
  }
}

export default QualityGate;
