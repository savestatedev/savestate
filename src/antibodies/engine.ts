/**
 * Failure Antibody preflight engine (MVP, warn-only)
 */

import { performance } from 'node:perf_hooks';
import { AntibodyStore } from './store.js';
import type { AntibodyRule, PreflightContext, PreflightResult, PreflightWarning } from './types.js';

export interface AntibodyEngineOptions {
  enableSemanticMatching?: boolean;
}

export interface PreflightOptions {
  updateHitCounters?: boolean;
}

export class AntibodyEngine {
  constructor(
    private readonly store: AntibodyStore,
    private readonly options: AntibodyEngineOptions = {},
  ) {}

  async preflight(context: PreflightContext, options: PreflightOptions = {}): Promise<PreflightResult> {
    const started = performance.now();
    const rules = await this.store.list({ activeOnly: true });
    const warnings: PreflightWarning[] = [];
    const matchedRuleIds: string[] = [];
    const semanticEnabled = Boolean(this.options.enableSemanticMatching);

    for (const rule of rules) {
      const reasonCodes = this.matchRule(rule, context);
      if (reasonCodes.length === 0) {
        continue;
      }

      warnings.push({
        rule_id: rule.id,
        intervention: rule.intervention,
        risk: rule.risk,
        safe_action: rule.safe_action,
        confidence: rule.confidence,
        reason_codes: reasonCodes,
      });
      matchedRuleIds.push(rule.id);
    }

    if (semanticEnabled && context.semantic_text) {
      // Stubbed for MVP. Semantic matching is intentionally disabled by default.
      this.semanticMatchStub(context.semantic_text, rules);
    }

    if (options.updateHitCounters) {
      for (const ruleId of matchedRuleIds) {
        await this.store.recordHit(ruleId);
      }
    }

    warnings.sort((a, b) => b.confidence - a.confidence || a.rule_id.localeCompare(b.rule_id));
    const elapsedMs = performance.now() - started;

    return {
      warnings,
      blocked: warnings.some((warning) => warning.intervention === 'block'),
      elapsed_ms: Number(elapsedMs.toFixed(3)),
      semantic_used: semanticEnabled && Boolean(context.semantic_text),
      matched_rule_ids: matchedRuleIds,
    };
  }

  private matchRule(
    rule: AntibodyRule,
    context: PreflightContext,
  ): Array<'tool' | 'error_code' | 'path_prefix' | 'tag' | 'semantic'> {
    const reasonCodes: Array<'tool' | 'error_code' | 'path_prefix' | 'tag' | 'semantic'> = [];
    const trigger = rule.trigger;

    if (!trigger.tool && !trigger.error_codes?.length && !trigger.path_prefixes?.length && !trigger.tags?.length) {
      return reasonCodes;
    }

    // Cheap matcher 1: tool name
    if (trigger.tool) {
      if (!context.tool || context.tool !== trigger.tool) {
        return [];
      }
      reasonCodes.push('tool');
    }

    // Cheap matcher 2: error code
    if (trigger.error_codes && trigger.error_codes.length > 0) {
      if (!context.error_code) {
        return [];
      }

      const matched = trigger.error_codes.includes(context.error_code.toUpperCase());
      if (!matched) {
        return [];
      }
      reasonCodes.push('error_code');
    }

    // Cheap matcher 3: path prefix
    if (trigger.path_prefixes && trigger.path_prefixes.length > 0) {
      if (!context.path) {
        return [];
      }

      const matched = trigger.path_prefixes.some((prefix) => context.path!.startsWith(prefix));
      if (!matched) {
        return [];
      }
      reasonCodes.push('path_prefix');
    }

    // Cheap matcher 4: tags
    if (trigger.tags && trigger.tags.length > 0) {
      if (!context.tags || context.tags.length === 0) {
        return [];
      }

      const tagSet = new Set(context.tags.map((tag) => tag.toLowerCase()));
      const matched = trigger.tags.some((tag) => tagSet.has(tag.toLowerCase()));
      if (!matched) {
        return [];
      }
      reasonCodes.push('tag');
    }

    return reasonCodes;
  }

  // Intentionally no semantic scoring for MVP.
  private semanticMatchStub(_semanticText: string, _rules: AntibodyRule[]): void {
    return;
  }
}

