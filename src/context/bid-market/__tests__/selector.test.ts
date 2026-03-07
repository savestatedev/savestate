/**
 * Tests for Policy-Governed Working-Set Bid Market
 * Issue #72
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BidMarketSelector,
  calculateBidScore,
  cosineSimilarity,
  areDuplicates,
  BidCandidate,
  BidMemoryType,
  MEMORY_TYPE_WEIGHTS,
  DEFAULT_BID_SCORING_WEIGHTS,
  DEFAULT_HARD_CONSTRAINTS,
} from '../index.js';

describe('BidMarketSelector', () => {
  let selector: BidMarketSelector;
  
  beforeEach(() => {
    selector = new BidMarketSelector();
  });
  
  describe('calculateBidScore', () => {
    it('should apply the correct scoring formula', () => {
      const candidate: BidCandidate = {
        id: 'test-1',
        memory_type: 'fact',
        content: 'Test fact',
        token_cost: 10,
        relevance: 0.8,
        certainty: 0.9,
        source_quality: 0.7,
        freshness: 0.6,
        novelty: 0.5,
        conflict_risk: 0.1,
        created_at: new Date().toISOString(),
      };
      
      const { score, breakdown } = calculateBidScore(candidate);
      
      // Manual calculation:
      // type_weight = 0.15 (fact)
      // relevance = 0.30 * 0.8 = 0.24
      // certainty = 0.20 * 0.9 = 0.18
      // source_quality = 0.15 * 0.7 = 0.105
      // freshness = 0.15 * 0.6 = 0.09
      // novelty = 0.10 * 0.5 = 0.05
      // conflict_risk = 0.20 * 0.1 = 0.02
      // total = 0.15 + 0.24 + 0.18 + 0.105 + 0.09 + 0.05 - 0.02 = 0.795
      
      expect(score).toBeCloseTo(0.795, 3);
      expect(breakdown.type_weight).toBe(MEMORY_TYPE_WEIGHTS.fact);
      expect(breakdown.relevance_contrib).toBeCloseTo(0.24, 3);
      expect(breakdown.conflict_risk_penalty).toBeCloseTo(0.02, 3);
    });
    
    it('should penalize high conflict risk', () => {
      const lowConflict: BidCandidate = {
        id: 'low-conflict',
        memory_type: 'fact',
        content: 'Low conflict',
        token_cost: 10,
        relevance: 0.8,
        certainty: 0.8,
        source_quality: 0.8,
        freshness: 0.8,
        novelty: 0.8,
        conflict_risk: 0.1,
        created_at: new Date().toISOString(),
      };
      
      const highConflict: BidCandidate = {
        ...lowConflict,
        id: 'high-conflict',
        conflict_risk: 0.9,
      };
      
      const { score: lowScore } = calculateBidScore(lowConflict);
      const { score: highScore } = calculateBidScore(highConflict);
      
      expect(lowScore).toBeGreaterThan(highScore);
      expect(lowScore - highScore).toBeCloseTo(0.16, 2); // 0.20 * (0.9 - 0.1)
    });
    
    it('should apply memory type weights correctly', () => {
      const createCandidate = (type: BidMemoryType): BidCandidate => ({
        id: `test-${type}`,
        memory_type: type,
        content: `Test ${type}`,
        token_cost: 10,
        relevance: 0.5,
        certainty: 0.5,
        source_quality: 0.5,
        freshness: 0.5,
        novelty: 0.5,
        conflict_risk: 0.0,
        created_at: new Date().toISOString(),
      });
      
      const goalCandidate = createCandidate('goal');
      const convCandidate = createCandidate('conversation');
      
      const { score: goalScore } = calculateBidScore(goalCandidate);
      const { score: convScore } = calculateBidScore(convCandidate);
      
      // Goal should score higher due to type weight
      expect(goalScore).toBeGreaterThan(convScore);
      expect(goalScore - convScore).toBeCloseTo(
        MEMORY_TYPE_WEIGHTS.goal - MEMORY_TYPE_WEIGHTS.conversation,
        3
      );
    });
  });
  
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const v = [1, 2, 3, 4];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
    });
    
    it('should return 0 for orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0, 5);
    });
    
    it('should return -1 for opposite vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [-1, -2, -3];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1, 5);
    });
    
    it('should handle empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });
    
    it('should handle mismatched lengths', () => {
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });
  
  describe('areDuplicates', () => {
    it('should detect duplicates with embeddings', () => {
      const a: BidCandidate = {
        id: 'a',
        memory_type: 'fact',
        content: 'The sky is blue',
        token_cost: 5,
        relevance: 0.8,
        certainty: 0.9,
        source_quality: 0.8,
        freshness: 0.7,
        novelty: 0.5,
        conflict_risk: 0.1,
        created_at: new Date().toISOString(),
        embedding: [0.1, 0.2, 0.3, 0.4],
      };
      
      const b: BidCandidate = {
        ...a,
        id: 'b',
        content: 'The sky appears blue',
        embedding: [0.11, 0.21, 0.31, 0.41], // Very similar
      };
      
      const { isDuplicate, similarity } = areDuplicates(a, b, 0.85);
      expect(isDuplicate).toBe(true);
      expect(similarity).toBeGreaterThan(0.99);
    });
    
    it('should fallback to content similarity without embeddings', () => {
      const a: BidCandidate = {
        id: 'a',
        memory_type: 'fact',
        content: 'The quick brown fox jumps',
        token_cost: 5,
        relevance: 0.8,
        certainty: 0.9,
        source_quality: 0.8,
        freshness: 0.7,
        novelty: 0.5,
        conflict_risk: 0.1,
        created_at: new Date().toISOString(),
      };
      
      const b: BidCandidate = {
        ...a,
        id: 'b',
        content: 'The quick brown fox leaps',
      };
      
      const { isDuplicate, similarity } = areDuplicates(a, b, 0.5);
      expect(isDuplicate).toBe(true);
      expect(similarity).toBeGreaterThan(0.5);
    });
  });
  
  describe('select', () => {
    it('should select highest-scoring candidates within budget', () => {
      const candidates: BidCandidate[] = [
        {
          id: 'goal-1',
          memory_type: 'goal',
          content: 'Complete task',
          token_cost: 10,
          relevance: 0.9,
          certainty: 0.95,
          source_quality: 0.9,
          freshness: 0.9,
          novelty: 0.8,
          conflict_risk: 0.05,
          created_at: new Date().toISOString(),
        },
        {
          id: 'fact-1',
          memory_type: 'fact',
          content: 'Important fact',
          token_cost: 15,
          relevance: 0.8,
          certainty: 0.9,
          source_quality: 0.85,
          freshness: 0.7,
          novelty: 0.6,
          conflict_risk: 0.1,
          created_at: new Date().toISOString(),
        },
        {
          id: 'conv-1',
          memory_type: 'conversation',
          content: 'Old conversation',
          token_cost: 20,
          relevance: 0.3,
          certainty: 0.5,
          source_quality: 0.5,
          freshness: 0.2,
          novelty: 0.2,
          conflict_risk: 0.0,
          created_at: new Date().toISOString(),
        },
      ];
      
      const result = selector.select(candidates, 30);
      
      expect(result.selected.length).toBeGreaterThan(0);
      expect(result.total_tokens_used).toBeLessThanOrEqual(30);
      expect(result.decision_trace.run_id).toBeDefined();
      expect(result.decision_trace.decisions.length).toBe(candidates.length);
    });
    
    it('should enforce category minima', () => {
      // Create selector with explicit minima - no required_categories to avoid voucher
      const selector = new BidMarketSelector({
        hard_constraints: {
          required_categories: [], // Disable required categories check
          category_minima: {
            goal: 1,
            constraint: 1,
          },
          category_maxima: {},
          duplicate_similarity_threshold: 0.85,
        },
      });
      
      const candidates: BidCandidate[] = [
        {
          id: 'goal-1',
          memory_type: 'goal',
          content: 'Goal',
          token_cost: 10,
          relevance: 0.5,
          certainty: 0.9, // High certainty to avoid voucher
          source_quality: 0.5,
          freshness: 0.5,
          novelty: 0.5,
          conflict_risk: 0.0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'constraint-1',
          memory_type: 'constraint',
          content: 'Constraint',
          token_cost: 10,
          relevance: 0.5,
          certainty: 0.9, // High certainty to avoid voucher
          source_quality: 0.5,
          freshness: 0.5,
          novelty: 0.5,
          conflict_risk: 0.0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'fact-high',
          memory_type: 'fact',
          content: 'High-scoring fact',
          token_cost: 10,
          relevance: 0.99,
          certainty: 0.99,
          source_quality: 0.99,
          freshness: 0.99,
          novelty: 0.99,
          conflict_risk: 0.0,
          created_at: new Date().toISOString(),
        },
      ];
      
      const result = selector.select(candidates, 50); // Enough budget for all 3
      
      // Should include all three - goal and constraint due to minima
      expect(result.selected.length).toBe(3);
      const selectedTypes = result.selected.map(c => c.memory_type);
      expect(selectedTypes).toContain('goal');
      expect(selectedTypes).toContain('constraint');
      expect(selectedTypes).toContain('fact');
    });
    
    it('should enforce category maxima', () => {
      const selector = new BidMarketSelector({
        hard_constraints: {
          required_categories: [], // Disable to avoid voucher complications
          category_minima: {},     // No minima
          category_maxima: {
            fact: 0.30, // Only 30% of budget
          },
          duplicate_similarity_threshold: 0.85,
        },
      });
      
      // Use unique content to avoid duplicate suppression
      const uniqueContents = [
        'The capital of France is Paris',
        'Water boils at 100 degrees celsius',
        'The Earth orbits the Sun',
        'Photosynthesis converts light to energy',
        'DNA contains genetic information',
        'Gravity is a fundamental force',
        'Electrons orbit atomic nuclei',
        'Sound travels through air',
        'Plants need water to survive',
        'The moon affects ocean tides',
      ];
      const candidates: BidCandidate[] = uniqueContents.map((content, i) => ({
        id: `fact-${i}`,
        memory_type: 'fact' as BidMemoryType,
        content,
        token_cost: 10,
        relevance: 0.9 - i * 0.05,
        certainty: 0.9,
        source_quality: 0.9,
        freshness: 0.9,
        novelty: 0.9,
        conflict_risk: 0.0,
        created_at: new Date().toISOString(),
      }));
      
      const result = selector.select(candidates, 100);
      
      // Should cap facts at 30 tokens (30% of 100)
      const factTokens = result.selected
        .filter(c => c.memory_type === 'fact')
        .reduce((sum, c) => sum + c.token_cost, 0);
      
      expect(factTokens).toBeLessThanOrEqual(30);
      // When more candidates are excluded due to cap, capped should be true
      expect(result.excluded.length).toBeGreaterThan(0);
      
      // Check that constraint log shows category was capped
      const capLog = result.decision_trace.constraint_enforcement.find(
        log => log.constraint_type === 'category_maximum' && log.category === 'fact'
      );
      expect(capLog).toBeDefined();
    });
    
    it('should suppress duplicates', () => {
      const candidates: BidCandidate[] = [
        {
          id: 'fact-1',
          memory_type: 'fact',
          content: 'The sky is blue',
          token_cost: 10,
          relevance: 0.9,
          certainty: 0.9,
          source_quality: 0.9,
          freshness: 0.9,
          novelty: 0.9,
          conflict_risk: 0.0,
          created_at: new Date().toISOString(),
          embedding: [0.1, 0.2, 0.3, 0.4],
        },
        {
          id: 'fact-2',
          memory_type: 'fact',
          content: 'The sky appears blue',
          token_cost: 10,
          relevance: 0.85,
          certainty: 0.85,
          source_quality: 0.85,
          freshness: 0.85,
          novelty: 0.85,
          conflict_risk: 0.0,
          created_at: new Date().toISOString(),
          embedding: [0.11, 0.21, 0.31, 0.41], // Very similar
        },
      ];
      
      const result = selector.select(candidates, 100);
      
      // Should suppress one as duplicate
      expect(result.decision_trace.duplicates_suppressed.length).toBe(1);
      expect(result.selected.length).toBe(1);
      expect(result.selected[0].id).toBe('fact-1'); // Higher scoring one kept
    });
    
    it('should trigger uncertainty voucher on low confidence', () => {
      const selector = new BidMarketSelector({
        confidence_threshold: 0.65,
        voucher_budget_percent: 0.15,
      });
      
      const candidates: BidCandidate[] = [
        {
          id: 'low-cert-1',
          memory_type: 'fact',
          content: 'Low certainty fact',
          token_cost: 20,
          relevance: 0.9,
          certainty: 0.3, // Very low certainty
          source_quality: 0.5,
          freshness: 0.9,
          novelty: 0.9,
          conflict_risk: 0.0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'low-cert-2',
          memory_type: 'fact',
          content: 'Another low certainty fact',
          token_cost: 20,
          relevance: 0.9,
          certainty: 0.4, // Low certainty
          source_quality: 0.5,
          freshness: 0.9,
          novelty: 0.9,
          conflict_risk: 0.0,
          created_at: new Date().toISOString(),
        },
      ];
      
      const result = selector.select(candidates, 100);
      
      expect(result.uncertainty_voucher).toBeDefined();
      expect(result.uncertainty_voucher!.triggered).toBe(true);
      expect(result.uncertainty_voucher!.reason).toBe('low_confidence');
      expect(result.uncertainty_voucher!.reserved_budget).toBe(15); // 15% of 100
    });
    
    it('should provide full decision trace', () => {
      const candidates: BidCandidate[] = [
        {
          id: 'test-1',
          memory_type: 'fact',
          content: 'Test',
          token_cost: 10,
          relevance: 0.8,
          certainty: 0.9,
          source_quality: 0.8,
          freshness: 0.7,
          novelty: 0.6,
          conflict_risk: 0.1,
          created_at: new Date().toISOString(),
        },
      ];
      
      const result = selector.select(candidates, 100);
      const trace = result.decision_trace;
      
      expect(trace.run_id).toBeDefined();
      expect(trace.timestamp).toBeDefined();
      expect(trace.total_candidates).toBe(1);
      expect(trace.decisions.length).toBe(1);
      expect(trace.decisions[0].score_breakdown).toBeDefined();
      expect(trace.selection_latency_ms).toBeGreaterThanOrEqual(0);
      expect(trace.overall_confidence).toBeCloseTo(0.9, 2);
    });
    
    it('should run shadow comparison when enabled', () => {
      const selector = new BidMarketSelector({
        enable_shadow_mode: true,
        shadow_baseline: 'recency',
      });
      
      const now = new Date();
      const candidates: BidCandidate[] = [
        {
          id: 'old-but-relevant',
          memory_type: 'fact',
          content: 'Old but relevant',
          token_cost: 10,
          relevance: 0.95,
          certainty: 0.9,
          source_quality: 0.9,
          freshness: 0.3, // Old
          novelty: 0.9,
          conflict_risk: 0.0,
          created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'new-but-irrelevant',
          memory_type: 'fact',
          content: 'New but irrelevant',
          token_cost: 10,
          relevance: 0.2,
          certainty: 0.5,
          source_quality: 0.5,
          freshness: 0.95, // Very fresh
          novelty: 0.2,
          conflict_risk: 0.0,
          created_at: now.toISOString(),
        },
      ];
      
      const result = selector.select(candidates, 15); // Only room for one
      
      expect(result.shadow_comparison).toBeDefined();
      expect(result.shadow_comparison!.baseline_method).toBe('recency');
      
      // Bid market should pick the more relevant one
      expect(result.selected[0].id).toBe('old-but-relevant');
      
      // Baseline (recency) would pick the newer one
      expect(result.shadow_comparison!.baseline_selected_ids).toContain('new-but-irrelevant');
    });
    
    it('should complete selection in reasonable time for moderate candidate counts', () => {
      const candidates: BidCandidate[] = Array.from({ length: 200 }, (_, i) => ({
        id: `candidate-${i}`,
        memory_type: (['fact', 'event', 'decision', 'preference'] as BidMemoryType[])[i % 4],
        content: `Test content ${i} with some additional words`,
        token_cost: 10 + (i % 20),
        relevance: Math.random(),
        certainty: Math.random(),
        source_quality: Math.random(),
        freshness: Math.random(),
        novelty: Math.random(),
        conflict_risk: Math.random() * 0.3,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      }));
      
      const result = selector.select(candidates, 1000);
      
      // Should complete in under 200ms for 200 candidates (CI variance)
      expect(result.decision_trace.selection_latency_ms).toBeLessThan(200);
      // Verify selection actually worked
      expect(result.selected.length).toBeGreaterThan(0);
    });
  });
});
