/**
 * Memory Delivery Plane - Quality Gate
 * 
 * Shadow mode compares full-context vs packet-context quality.
 */

import { TaskPacket } from '../packet-builder/index.js';

/**
 * Quality metric types
 */
export enum QualityMetric {
  RELEVANCE = 'relevance',
  COMPLETENESS = 'completeness',
  ACCURACY = 'accuracy',
  COHERENCE = 'coherence',
}

/**
 * Quality score for a single metric (0-1)
 */
export interface MetricScore {
  metric: QualityMetric;
  score: number;
  details?: string;
}

/**
 * Overall quality comparison result
 */
export interface QualityResult {
  /** Unique comparison ID */
  comparison_id: string;
  
  /** Timestamp of comparison */
  timestamp: string;
  
  /** Full context quality scores */
  fullContext: MetricScore[];
  
  /** Packet context quality scores */
  packetContext: MetricScore[];
  
  /** Difference scores (full - packet) */
  deltas: MetricScore[];
  
  /** Overall quality regression (positive = packet is worse) */
  overallRegression: number;
  
  /** Whether regression exceeds threshold */
  regressionExceedsThreshold: boolean;
  
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Quality evaluation result for a single context
 */
export interface ContextQuality {
  scores: MetricScore[];
  overallScore: number;
}

/**
 * Configuration for quality gate
 */
export interface QualityGateConfig {
  /** Maximum acceptable regression (0-1, default 0.02 = 2%) */
  regressionThreshold: number;
  
  /** Whether to enable shadow mode (run but don't use) */
  shadowMode: boolean;
  
  /** Sample rate for quality checks (0-1) */
  sampleRate: number;
  
  /** Custom weights for metrics */
  metricWeights?: Partial<Record<QualityMetric, number>>;
}

/**
 * QualityGate - compares full-context vs packet-context quality
 */
export class QualityGate {
  private config: QualityGateConfig;
  private defaultWeights: Record<QualityMetric, number>;

  constructor(config: Partial<QualityGateConfig> = {}) {
    this.config = {
      regressionThreshold: config.regressionThreshold ?? 0.02,
      shadowMode: config.shadowMode ?? true,
      sampleRate: config.sampleRate ?? 0.1,
      metricWeights: config.metricWeights ?? {},
    };

    // Default weights for each metric
    this.defaultWeights = {
      [QualityMetric.RELEVANCE]: 0.3,
      [QualityMetric.COMPLETENESS]: 0.3,
      [QualityMetric.ACCURACY]: 0.25,
      [QualityMetric.COHERENCE]: 0.15,
      ...this.config.metricWeights,
    };
  }

  /**
   * Generate a unique comparison ID
   */
  private generateComparisonId(): string {
    return `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get the weight for a metric
   */
  private getMetricWeight(metric: QualityMetric): number {
    return this.defaultWeights[metric] ?? 0.25;
  }

  /**
   * Calculate relevance score (simple keyword overlap)
   */
  private calculateRelevance(content: string, query: string): number {
    if (!query) return 0.5;
    
    const contentLower = content.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    const matches = queryTerms.filter(term => contentLower.includes(term)).length;
    return Math.min(1, matches / queryTerms.length);
  }

  /**
   * Calculate completeness score based on expected topics
   */
  private calculateCompleteness(content: string, expectedTopics: string[]): number {
    if (!expectedTopics || expectedTopics.length === 0) return 0.7;
    
    const contentLower = content.toLowerCase();
    const covered = expectedTopics.filter(topic => 
      contentLower.includes(topic.toLowerCase())
    ).length;
    
    return covered / expectedTopics.length;
  }

  /**
   * Calculate coherence score (simple sentence count / paragraph structure)
   */
  private calculateCoherence(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 0);
    
    // More sentences and paragraphs = better coherence
    const sentenceScore = Math.min(1, sentences.length / 5);
    const paragraphScore = Math.min(1, paragraphs.length / 2);
    
    return (sentenceScore + paragraphScore) / 2;
  }

  /**
   * Calculate accuracy score (placeholder - would need LLM evaluation)
   */
  private calculateAccuracy(content: string): number {
    // Placeholder: in production, this would use LLM evaluation
    // For now, return a reasonable default
    const hasFactualMarkers = /(\d+|percent%|\$\d+)/.test(content);
    return hasFactualMarkers ? 0.8 : 0.7;
  }

  /**
   * Evaluate quality for a single context
   */
  evaluateContext(
    content: string, 
    query?: string,
    expectedTopics?: string[]
  ): ContextQuality {
    const scores: MetricScore[] = [];

    // Relevance
    const relevanceScore = query 
      ? this.calculateRelevance(content, query)
      : 0.5;
    scores.push({
      metric: QualityMetric.RELEVANCE,
      score: relevanceScore,
      details: query ? `Query: "${query}"` : undefined,
    });

    // Completeness
    const completenessScore = expectedTopics
      ? this.calculateCompleteness(content, expectedTopics)
      : 0.7;
    scores.push({
      metric: QualityMetric.COMPLETENESS,
      score: completenessScore,
      details: expectedTopics ? `Expected topics: ${expectedTopics.join(', ')}` : undefined,
    });

    // Accuracy (placeholder)
    const accuracyScore = this.calculateAccuracy(content);
    scores.push({
      metric: QualityMetric.ACCURACY,
      score: accuracyScore,
      details: 'Placeholder evaluation',
    });

    // Coherence
    const coherenceScore = this.calculateCoherence(content);
    scores.push({
      metric: QualityMetric.COHERENCE,
      score: coherenceScore,
      details: `Sentences: ${content.split(/[.!?]+/).filter(s => s.trim()).length}`,
    });

    // Calculate weighted overall score
    const overallScore = scores.reduce((sum, metricScore) => {
      return sum + metricScore.score * this.getMetricWeight(metricScore.metric);
    }, 0);

    return { scores, overallScore };
  }

  /**
   * Compare full context vs packet context quality
   */
  compare(
    fullContext: string,
    packetContext: string,
    query?: string,
    expectedTopics?: string[]
  ): QualityResult {
    // Evaluate both contexts
    const fullQuality = this.evaluateContext(fullContext, query, expectedTopics);
    const packetQuality = this.evaluateContext(packetContext, query, expectedTopics);

    // Calculate deltas
    const deltas: MetricScore[] = fullQuality.scores.map(fullScore => {
      const packetScore = packetQuality.scores.find(
        s => s.metric === fullScore.metric
      );
      return {
        metric: fullScore.metric,
        score: fullScore.score - (packetScore?.score ?? 0),
        details: `Full: ${fullScore.score.toFixed(2)}, Packet: ${(packetScore?.score ?? 0).toFixed(2)}`,
      };
    });

    // Calculate overall regression
    const overallRegression = fullQuality.overallScore - packetQuality.overallScore;
    const regressionExceedsThreshold = overallRegression > this.config.regressionThreshold;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (regressionExceedsThreshold) {
      recommendations.push(`Quality regression (${(overallRegression * 100).toFixed(1)}%) exceeds threshold (${(this.config.regressionThreshold * 100).toFixed(1)}%)`);
    }

    // Per-metric recommendations
    for (const delta of deltas) {
      if (delta.score > 0.1) {
        recommendations.push(`Consider including more content for ${delta.metric} (gap: ${(delta.score * 100).toFixed(1)}%)`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Quality gate passed - packet context acceptable');
    }

    return {
      comparison_id: this.generateComparisonId(),
      timestamp: new Date().toISOString(),
      fullContext: fullQuality.scores,
      packetContext: packetQuality.scores,
      deltas,
      overallRegression,
      regressionExceedsThreshold,
      recommendations,
    };
  }

  /**
   * Check if quality gate should be evaluated (based on sample rate)
   */
  shouldEvaluate(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  /**
   * Get current configuration
   */
  getConfig(): QualityGateConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<QualityGateConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

export default QualityGate;
