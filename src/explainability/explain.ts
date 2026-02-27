/**
 * SaveState Retrieval Explainability
 *
 * "Why this memory?" inspector that provides transparency into
 * why specific memories/chunks were selected during retrieval.
 *
 * Addresses the "black box retrieval" concern for production users.
 */

import type {
  MemoryEntry,
  MemoryTier,
  MemoryTierConfig,
  Snapshot,
  RetrievalExplanation,
  ScoreBreakdown,
  ScoreFactor,
  SourceTrace,
  PolicyPathEntry,
} from '../types.js';
import {
  DEFAULT_SCORING_WEIGHTS,
  TIER_BOOSTS,
  type ExplainOptions,
  type ScoringWeights,
} from './types.js';
import { scoreMatch } from '../search.js';
import { getEffectiveTier, DEFAULT_TIER_CONFIG, parseDuration } from '../commands/memory.js';

/**
 * Generate a retrieval explanation for a memory entry.
 */
export function explainMemory(
  entry: MemoryEntry,
  snapshot: Snapshot,
  options?: ExplainOptions,
): RetrievalExplanation {
  const weights = DEFAULT_SCORING_WEIGHTS;
  const tierConfig = snapshot.memory.tierConfig ?? DEFAULT_TIER_CONFIG;

  const scoreBreakdown = calculateScoreBreakdown(entry, options?.query, weights);
  const sourceTrace = buildSourceTrace(entry, snapshot);
  const policyPath = buildPolicyPath(entry, tierConfig);
  const compositeScore = calculateCompositeScore(scoreBreakdown, weights);
  const summary = generateSummary(entry, compositeScore, scoreBreakdown, policyPath);

  return {
    memoryId: entry.id,
    compositeScore,
    scoreBreakdown,
    sourceTrace,
    policyPath,
    summary,
  };
}

/**
 * Calculate the breakdown of scoring factors.
 */
export function calculateScoreBreakdown(
  entry: MemoryEntry,
  query?: string,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): ScoreBreakdown {
  const factors: ScoreFactor[] = [];

  // 1. Relevance score (if query provided)
  const relevanceScore = query ? scoreMatch(query, entry.content) : 1.0;
  factors.push({
    name: 'relevance',
    value: relevanceScore,
    weight: weights.relevance,
    contribution: relevanceScore * weights.relevance,
    explanation: query
      ? `Content similarity to query "${truncate(query, 30)}": ${formatPercent(relevanceScore)}`
      : 'No query provided; assuming full relevance',
  });

  // 2. Recency weight
  const recencyWeight = calculateRecencyWeight(entry);
  const ageInDays = calculateAgeInDays(entry);
  factors.push({
    name: 'recency',
    value: recencyWeight,
    weight: weights.recency,
    contribution: recencyWeight * weights.recency,
    explanation: `Memory age: ${formatAge(ageInDays)}. Recency score: ${formatPercent(recencyWeight)}`,
  });

  // 3. Tier boost
  const tier = getEffectiveTier(entry);
  const tierBoost = TIER_BOOSTS[tier] ?? 0.4;
  factors.push({
    name: 'tier',
    value: tierBoost,
    weight: weights.tier,
    contribution: tierBoost * weights.tier,
    explanation: `Memory tier: ${tier}. ${getTierDescription(tier)}`,
  });

  // 4. Access frequency boost
  const accessBoost = calculateAccessBoost(entry);
  factors.push({
    name: 'access',
    value: accessBoost,
    weight: weights.access,
    contribution: accessBoost * weights.access,
    explanation: entry.lastAccessedAt
      ? `Last accessed: ${formatTimestamp(entry.lastAccessedAt)}`
      : 'Never accessed since creation',
  });

  // 5. Pinned boost
  const pinnedBoost = entry.pinned ? 1.0 : 0.0;
  factors.push({
    name: 'pinned',
    value: pinnedBoost,
    weight: weights.pinned,
    contribution: pinnedBoost * weights.pinned,
    explanation: entry.pinned
      ? `📌 Pinned since ${formatTimestamp(entry.pinnedAt!)}`
      : 'Not pinned',
  });

  return {
    relevanceScore,
    recencyWeight,
    tierBoost,
    accessBoost,
    pinnedBoost,
    factors,
  };
}

/**
 * Calculate composite score from breakdown.
 */
export function calculateCompositeScore(
  breakdown: ScoreBreakdown,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedSum = breakdown.factors.reduce((sum, f) => sum + f.contribution, 0);
  return Math.min(1, weightedSum / totalWeight);
}

/**
 * Build source trace information.
 */
export function buildSourceTrace(
  entry: MemoryEntry,
  snapshot: Snapshot,
): SourceTrace {
  const chain = snapshot.chain;

  // Determine source type from metadata or source field
  const sourceType = determineSourceType(entry);

  return {
    originSnapshotId: chain.ancestors.length > 0 ? chain.ancestors[0] : chain.current,
    originTimestamp: entry.createdAt,
    adapter: snapshot.manifest.adapter,
    platform: snapshot.manifest.platform,
    currentSnapshotId: snapshot.manifest.id,
    snapshotChain: [...chain.ancestors, chain.current],
    sourceId: entry.metadata?.sourceId as string | undefined,
    sourceType,
  };
}

/**
 * Build policy path showing which rules affected this memory.
 */
export function buildPolicyPath(
  entry: MemoryEntry,
  tierConfig: MemoryTierConfig,
): PolicyPathEntry[] {
  const policies: PolicyPathEntry[] = [];
  const tier = getEffectiveTier(entry);

  // Tier assignment policy
  policies.push({
    policyName: 'tier-assignment',
    ruleType: 'tier',
    action: 'include',
    reason: `Assigned to tier ${tier} (${getTierDescription(tier)})`,
  });

  // Context inclusion policy
  const tierSettings = tierConfig.tiers[tier];
  if (tierSettings.includeInContext) {
    policies.push({
      policyName: 'context-inclusion',
      ruleType: 'tier',
      action: 'include',
      reason: `${tier} memories are included in agent context by default`,
    });
  } else {
    policies.push({
      policyName: 'context-exclusion',
      ruleType: 'tier',
      action: 'exclude',
      reason: `${tier} memories are not included in agent context (archive tier)`,
    });
  }

  // Pinned status policy
  if (entry.pinned) {
    policies.push({
      policyName: 'pin-protection',
      ruleType: 'pin',
      action: 'boost',
      appliedAt: entry.pinnedAt,
      reason: 'Memory is pinned; protected from automatic demotion',
    });
  }

  // Age-based demotion policy check
  if (tierSettings.maxAge && !entry.pinned) {
    const maxAgeMs = parseDuration(tierSettings.maxAge);
    const entryDate = new Date(entry.lastAccessedAt ?? entry.updatedAt ?? entry.createdAt);
    const age = Date.now() - entryDate.getTime();

    if (age > maxAgeMs * 0.8) {
      policies.push({
        policyName: 'age-demotion-warning',
        ruleType: 'age',
        action: 'penalize',
        reason: `Memory is ${formatPercent(age / maxAgeMs)} through ${tierSettings.maxAge} age limit; may be demoted soon`,
      });
    }
  }

  // Promotion/demotion history
  if (entry.promotedAt) {
    policies.push({
      policyName: 'manual-promotion',
      ruleType: 'manual',
      action: 'promote',
      appliedAt: entry.promotedAt,
      reason: `Promoted from ${entry.previousTier ?? 'unknown'} to ${tier}`,
    });
  }

  if (entry.demotedAt) {
    policies.push({
      policyName: 'demotion',
      ruleType: entry.pinned ? 'manual' : 'age',
      action: 'demote',
      appliedAt: entry.demotedAt,
      reason: `Demoted from ${entry.previousTier ?? 'unknown'} to ${tier}`,
    });
  }

  return policies;
}

/**
 * Generate a human-readable summary.
 */
export function generateSummary(
  entry: MemoryEntry,
  compositeScore: number,
  breakdown: ScoreBreakdown,
  policies: PolicyPathEntry[],
): string {
  const tier = getEffectiveTier(entry);
  const lines: string[] = [];

  // Overall score
  lines.push(`📊 Composite Score: ${formatPercent(compositeScore)}`);

  // Top contributing factors
  const sortedFactors = [...breakdown.factors].sort((a, b) => b.contribution - a.contribution);
  const topFactors = sortedFactors.slice(0, 2);
  const factorNames = topFactors.map((f) => f.name).join(' and ');
  lines.push(`🔑 Top factors: ${factorNames}`);

  // Tier and pinned status
  const pinStatus = entry.pinned ? '📌 Pinned' : '';
  lines.push(`📁 Tier: ${tier} ${pinStatus}`.trim());

  // Active policies
  const activePolicies = policies.filter((p) => p.action === 'boost' || p.action === 'include');
  if (activePolicies.length > 0) {
    lines.push(`📋 Active policies: ${activePolicies.map((p) => p.policyName).join(', ')}`);
  }

  return lines.join('\n');
}

// ─── Helper Functions ───────────────────────────────────────

function calculateRecencyWeight(entry: MemoryEntry): number {
  const now = Date.now();
  const entryDate = new Date(entry.lastAccessedAt ?? entry.updatedAt ?? entry.createdAt);
  const ageMs = now - entryDate.getTime();

  // Decay function: 1.0 for today, decays to 0.1 over 90 days
  const dayMs = 24 * 60 * 60 * 1000;
  const ageDays = ageMs / dayMs;
  const decayRate = 0.02; // ~50% at 30 days, ~10% at 90 days

  return Math.max(0.1, Math.exp(-decayRate * ageDays));
}

function calculateAgeInDays(entry: MemoryEntry): number {
  const now = Date.now();
  const entryDate = new Date(entry.createdAt);
  const dayMs = 24 * 60 * 60 * 1000;
  return (now - entryDate.getTime()) / dayMs;
}

function calculateAccessBoost(entry: MemoryEntry): number {
  if (!entry.lastAccessedAt) return 0.3; // Base score for never-accessed

  const now = Date.now();
  const lastAccess = new Date(entry.lastAccessedAt);
  const daysSinceAccess = (now - lastAccess.getTime()) / (24 * 60 * 60 * 1000);

  // Recent access boosts score
  if (daysSinceAccess < 1) return 1.0;
  if (daysSinceAccess < 7) return 0.8;
  if (daysSinceAccess < 30) return 0.5;
  return 0.3;
}

function determineSourceType(entry: MemoryEntry): SourceTrace['sourceType'] {
  const source = entry.source?.toLowerCase() ?? '';
  const metadata = entry.metadata ?? {};

  if (source.includes('conversation') || metadata.conversationId) return 'conversation';
  if (source.includes('import') || metadata.importedFrom) return 'import';
  if (source.includes('system') || source.includes('auto')) return 'system';
  if (source.includes('manual') || source.includes('user')) return 'manual';
  return 'unknown';
}

function getTierDescription(tier: MemoryTier): string {
  switch (tier) {
    case 'L1':
      return 'Short-term buffer (fastest access, included in context)';
    case 'L2':
      return 'Working set (recent + pinned, fast retrieval)';
    case 'L3':
      return 'Long-term archive (searchable, not in default context)';
    default:
      return 'Unknown tier';
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatAge(days: number): string {
  if (days < 1) return 'less than a day';
  if (days < 2) return '1 day';
  if (days < 7) return `${Math.round(days)} days`;
  if (days < 30) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 3)}...`;
}

// ─── Formatting Functions ───────────────────────────────────

/**
 * Format explanation as human-readable text.
 */
export function formatExplanationHuman(explanation: RetrievalExplanation): string {
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push(`🔍 Memory Retrieval Explanation`);
  lines.push(`   ID: ${explanation.memoryId}`);
  lines.push('═'.repeat(60));
  lines.push('');

  // Summary
  lines.push(explanation.summary);
  lines.push('');

  // Score Breakdown
  lines.push('─'.repeat(60));
  lines.push('📊 SCORE BREAKDOWN');
  lines.push('─'.repeat(60));
  for (const factor of explanation.scoreBreakdown.factors) {
    const bar = '█'.repeat(Math.round(factor.value * 10)).padEnd(10, '░');
    lines.push(`  ${factor.name.padEnd(12)} ${bar} ${formatPercent(factor.value).padStart(4)} × ${factor.weight.toFixed(2)} = ${formatPercent(factor.contribution).padStart(4)}`);
    lines.push(`                 └─ ${factor.explanation}`);
  }
  lines.push('');
  lines.push(`  ${'COMPOSITE'.padEnd(12)} ${'█'.repeat(Math.round(explanation.compositeScore * 10)).padEnd(10, '░')} ${formatPercent(explanation.compositeScore)}`);
  lines.push('');

  // Source Trace
  lines.push('─'.repeat(60));
  lines.push('🔗 SOURCE TRACE');
  lines.push('─'.repeat(60));
  const trace = explanation.sourceTrace;
  lines.push(`  Origin:    ${trace.originSnapshotId}`);
  lines.push(`  Created:   ${formatTimestamp(trace.originTimestamp)}`);
  lines.push(`  Adapter:   ${trace.adapter}`);
  lines.push(`  Platform:  ${trace.platform}`);
  lines.push(`  Source:    ${trace.sourceType}${trace.sourceId ? ` (${trace.sourceId})` : ''}`);
  if (trace.snapshotChain.length > 1) {
    lines.push(`  Chain:     ${trace.snapshotChain.length} snapshots`);
  }
  lines.push('');

  // Policy Path
  lines.push('─'.repeat(60));
  lines.push('📋 POLICY PATH');
  lines.push('─'.repeat(60));
  for (const policy of explanation.policyPath) {
    const icon = getActionIcon(policy.action);
    lines.push(`  ${icon} ${policy.policyName} (${policy.ruleType})`);
    lines.push(`     └─ ${policy.reason}`);
    if (policy.appliedAt) {
      lines.push(`        Applied: ${formatTimestamp(policy.appliedAt)}`);
    }
  }
  lines.push('');
  lines.push('═'.repeat(60));

  return lines.join('\n');
}

/**
 * Format explanation as markdown.
 */
export function formatExplanationMarkdown(explanation: RetrievalExplanation): string {
  const lines: string[] = [];

  lines.push(`## 🔍 Memory Retrieval Explanation`);
  lines.push(`**Memory ID:** \`${explanation.memoryId}\``);
  lines.push('');
  lines.push(`### Summary`);
  lines.push(explanation.summary);
  lines.push('');

  lines.push(`### 📊 Score Breakdown`);
  lines.push('');
  lines.push(`| Factor | Score | Weight | Contribution |`);
  lines.push(`|--------|-------|--------|--------------|`);
  for (const factor of explanation.scoreBreakdown.factors) {
    lines.push(`| ${factor.name} | ${formatPercent(factor.value)} | ${factor.weight.toFixed(2)} | ${formatPercent(factor.contribution)} |`);
  }
  lines.push(`| **Composite** | **${formatPercent(explanation.compositeScore)}** | | |`);
  lines.push('');

  lines.push(`### 🔗 Source Trace`);
  const trace = explanation.sourceTrace;
  lines.push(`- **Origin Snapshot:** \`${trace.originSnapshotId}\``);
  lines.push(`- **Created:** ${formatTimestamp(trace.originTimestamp)}`);
  lines.push(`- **Adapter:** ${trace.adapter}`);
  lines.push(`- **Platform:** ${trace.platform}`);
  lines.push(`- **Source Type:** ${trace.sourceType}`);
  if (trace.snapshotChain.length > 1) {
    lines.push(`- **Snapshot Chain:** ${trace.snapshotChain.length} snapshots`);
  }
  lines.push('');

  lines.push(`### 📋 Policy Path`);
  for (const policy of explanation.policyPath) {
    const icon = getActionIcon(policy.action);
    lines.push(`- ${icon} **${policy.policyName}** (${policy.ruleType}): ${policy.reason}`);
  }

  return lines.join('\n');
}

function getActionIcon(action: PolicyPathEntry['action']): string {
  switch (action) {
    case 'include':
      return '✅';
    case 'exclude':
      return '❌';
    case 'promote':
      return '⬆️';
    case 'demote':
      return '⬇️';
    case 'boost':
      return '🚀';
    case 'penalize':
      return '⚠️';
    default:
      return '•';
  }
}
