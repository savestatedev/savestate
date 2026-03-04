/**
 * Candidate Scoring for Preflight Context Compiler
 * Issue #54: Score candidates for inclusion in RunBrief
 */

import { ScoringWeights, DEFAULT_SCORING_WEIGHTS } from './types.js';

/**
 * A candidate memory/fact for inclusion in context
 */
export interface Candidate {
  id: string;
  content: string;
  type: 'fact' | 'entity' | 'loop' | 'constraint' | 'decision' | 'memory';
  created_at: string;
  updated_at?: string;
  importance?: number;
  criticality?: number;
  trust?: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Scored candidate with breakdown
 */
export interface ScoredCandidate extends Candidate {
  score: number;
  score_breakdown: {
    relevance: number;
    recency: number;
    importance: number;
    criticality: number;
    trust: number;
    redundancy_penalty: number;
  };
}

/**
 * Calculate relevance score based on semantic similarity
 */
export function calculateRelevance(
  candidate: Candidate,
  taskEmbedding: number[] | undefined,
  taskKeywords: string[]
): number {
  // If we have embeddings, use cosine similarity
  if (candidate.embedding && taskEmbedding) {
    return cosineSimilarity(candidate.embedding, taskEmbedding);
  }
  
  // Fallback to keyword matching
  const content = candidate.content.toLowerCase();
  const matchCount = taskKeywords.filter(kw => content.includes(kw.toLowerCase())).length;
  return Math.min(1, matchCount / Math.max(1, taskKeywords.length));
}

/**
 * Calculate recency score (exponential decay)
 */
export function calculateRecency(candidate: Candidate, now: Date = new Date()): number {
  const timestamp = new Date(candidate.updated_at || candidate.created_at);
  const ageMs = now.getTime() - timestamp.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  // Exponential decay with half-life of 7 days
  const halfLife = 7;
  return Math.exp(-0.693 * ageDays / halfLife);
}

/**
 * Calculate redundancy penalty based on similarity to already-included items
 */
export function calculateRedundancy(
  candidate: Candidate,
  included: Candidate[]
): number {
  if (included.length === 0) return 0;
  
  // Simple content overlap check
  const candidateWords = new Set(candidate.content.toLowerCase().split(/\s+/));
  
  let maxOverlap = 0;
  for (const item of included) {
    const itemWords = new Set(item.content.toLowerCase().split(/\s+/));
    const intersection = [...candidateWords].filter(w => itemWords.has(w));
    const overlap = intersection.length / Math.max(candidateWords.size, 1);
    maxOverlap = Math.max(maxOverlap, overlap);
  }
  
  return maxOverlap;
}

/**
 * Score a candidate for inclusion
 */
export function scoreCandidate(
  candidate: Candidate,
  taskEmbedding: number[] | undefined,
  taskKeywords: string[],
  includedCandidates: Candidate[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): ScoredCandidate {
  const relevance = calculateRelevance(candidate, taskEmbedding, taskKeywords);
  const recency = calculateRecency(candidate);
  const importance = candidate.importance ?? 0.5;
  const criticality = candidate.criticality ?? 0.5;
  const trust = candidate.trust ?? 0.5;
  const redundancy_penalty = calculateRedundancy(candidate, includedCandidates);
  
  const score = 
    weights.relevance * relevance +
    weights.recency * recency +
    weights.importance * importance +
    weights.criticality * criticality +
    weights.trust * trust -
    weights.redundancy * redundancy_penalty;
  
  return {
    ...candidate,
    score,
    score_breakdown: {
      relevance,
      recency,
      importance,
      criticality,
      trust,
      redundancy_penalty,
    },
  };
}

/**
 * Score and rank multiple candidates
 */
export function rankCandidates(
  candidates: Candidate[],
  taskEmbedding: number[] | undefined,
  taskKeywords: string[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): ScoredCandidate[] {
  const scored: ScoredCandidate[] = [];
  const included: Candidate[] = [];
  
  // Sort by initial score (without redundancy)
  const initialScores = candidates.map(c => ({
    candidate: c,
    initialScore: 
      weights.relevance * calculateRelevance(c, taskEmbedding, taskKeywords) +
      weights.recency * calculateRecency(c) +
      weights.importance * (c.importance ?? 0.5) +
      weights.criticality * (c.criticality ?? 0.5) +
      weights.trust * (c.trust ?? 0.5),
  }));
  
  initialScores.sort((a, b) => b.initialScore - a.initialScore);
  
  // Re-score with redundancy penalty in order
  for (const { candidate } of initialScores) {
    const scoredCandidate = scoreCandidate(
      candidate,
      taskEmbedding,
      taskKeywords,
      included,
      weights
    );
    scored.push(scoredCandidate);
    included.push(candidate);
  }
  
  // Final sort by score
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
