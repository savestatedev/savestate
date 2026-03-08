/**
 * Policy-Governed Working-Set Bid Market
 * Issue #72: Turn memory from storage into a decision layer
 *
 * Implements deterministic, auditable context selection with:
 * - Score formula: w_type + 0.30*relevance + 0.20*certainty + 0.15*source_quality
 *                  + 0.15*freshness + 0.10*novelty - 0.20*conflict_risk
 * - Hard constraints: always-include, category minima/maxima, duplicate suppression
 * - Uncertainty vouchers: reserve budget when confidence < 0.65
 * - Full decision trace: 100% traceability for inclusion/exclusion
 * - Shadow mode: compare against recency/similarity baseline
 */

export * from './types.js';
export * from './selector.js';
