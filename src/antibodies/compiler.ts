/**
 * Deterministic FailureEvent -> AntibodyRule compiler (MVP)
 */

import { createHash } from 'node:crypto';
import type {
  AntibodyRule,
  FailureEvent,
  RiskLevel,
  SafeAction,
  SafeActionType,
  ToolFailureEvent,
  UserCorrectionEvent,
} from './types.js';

const KNOWN_SAFE_ACTIONS: Record<UserCorrectionEvent['correction_code'], SafeActionType> = {
  wrong_path: 'validate_inputs',
  missing_permission: 'check_permissions',
  unsafe_write: 'run_read_only_probe',
  wrong_tool: 'confirm_with_user',
  other: 'confirm_with_user',
};

const TOOL_FAILURE_ACTIONS: Record<string, SafeActionType> = {
  EACCES: 'check_permissions',
  EPERM: 'check_permissions',
  ENOENT: 'validate_inputs',
  ETIMEDOUT: 'retry_with_backoff',
  ECONNRESET: 'retry_with_backoff',
};

const TOOL_FAILURE_RISK: Record<string, RiskLevel> = {
  EACCES: 'high',
  EPERM: 'high',
  ENOENT: 'medium',
  ETIMEDOUT: 'medium',
  ECONNRESET: 'medium',
};

export class AntibodyCompiler {
  compile(events: FailureEvent[]): AntibodyRule[] {
    const byId = new Map<string, AntibodyRule>();
    const sorted = [...events].sort((a, b) => sortEventKey(a).localeCompare(sortEventKey(b)));

    for (const event of sorted) {
      const rule = this.compileEvent(event);
      if (rule) {
        byId.set(rule.id, rule);
      }
    }

    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  compileEvent(event: FailureEvent): AntibodyRule | null {
    if (event.type === 'user_correction') {
      return compileUserCorrection(event);
    }

    return compileToolFailure(event);
  }
}

function compileUserCorrection(event: UserCorrectionEvent): AntibodyRule {
  const trigger = {
    tool: normalizeOptionalText(event.tool),
    error_codes: event.error_code ? [event.error_code.toUpperCase()] : undefined,
    path_prefixes: event.path ? [toPathPrefix(event.path)] : undefined,
    tags: normalizeTags(event.tags),
  };

  const safeAction: SafeAction = event.safe_action ?? {
    type: KNOWN_SAFE_ACTIONS[event.correction_code],
  };

  const rule = {
    trigger,
    risk: event.risk ?? 'high',
    safe_action: safeAction,
    scope: {
      project: 'local',
    },
    confidence: event.safe_action ? 0.95 : 0.9,
    intervention: 'warn' as const,
  };

  return {
    ...rule,
    id: deriveRuleId(rule),
    created_at: event.timestamp,
    source_event_ids: [event.id],
    hits: 0,
    overrides: 0,
  };
}

function compileToolFailure(event: ToolFailureEvent): AntibodyRule | null {
  if (!event.hard) {
    return null;
  }

  const normalizedCode = event.error_code.toUpperCase();
  const safeActionType = TOOL_FAILURE_ACTIONS[normalizedCode] ?? 'run_read_only_probe';
  const risk = TOOL_FAILURE_RISK[normalizedCode] ?? 'medium';

  const rule = {
    trigger: {
      tool: normalizeOptionalText(event.tool),
      error_codes: [normalizedCode],
      path_prefixes: event.path ? [toPathPrefix(event.path)] : undefined,
      tags: normalizeTags(event.tags),
    },
    risk,
    safe_action: { type: safeActionType },
    scope: {
      project: 'local',
    },
    confidence: safeActionType === 'run_read_only_probe' ? 0.72 : 0.8,
    intervention: 'warn' as const,
  };

  return {
    ...rule,
    id: deriveRuleId(rule),
    created_at: event.timestamp,
    source_event_ids: [event.id],
    hits: 0,
    overrides: 0,
  };
}

export function deriveRuleId(rule: Pick<
  AntibodyRule,
  'trigger' | 'risk' | 'safe_action' | 'scope' | 'confidence' | 'intervention'
>): string {
  const stable = {
    trigger: {
      tool: normalizeOptionalText(rule.trigger.tool),
      error_codes: rule.trigger.error_codes?.map((value) => value.toUpperCase()).sort(),
      path_prefixes: rule.trigger.path_prefixes?.map((value) => toPathPrefix(value)).sort(),
      tags: normalizeTags(rule.trigger.tags),
    },
    risk: rule.risk,
    safe_action: {
      type: rule.safe_action.type,
      params: normalizeParams(rule.safe_action.params),
    },
    scope: {
      project: normalizeOptionalText(rule.scope.project),
      adapters: rule.scope.adapters?.slice().sort(),
      tags: normalizeTags(rule.scope.tags),
    },
    confidence: Number(rule.confidence.toFixed(4)),
    intervention: rule.intervention,
  };

  const digest = createHash('sha256').update(JSON.stringify(stable)).digest('hex');
  return `ab_${digest.slice(0, 16)}`;
}

function normalizeOptionalText(input?: string): string | undefined {
  const value = input?.trim();
  return value ? value : undefined;
}

function normalizeTags(tags?: string[]): string[] | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort();
}

function normalizeParams(
  params: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!params) {
    return undefined;
  }

  const normalized: Record<string, string | number | boolean> = {};
  const keys = Object.keys(params).sort();
  for (const key of keys) {
    normalized[key] = params[key];
  }
  return normalized;
}

function toPathPrefix(path: string): string {
  const trimmed = path.trim();
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length === 0) {
    return '/';
  }

  const size = Math.min(2, parts.length);
  return `/${parts.slice(0, size).join('/')}`;
}

function sortEventKey(event: FailureEvent): string {
  return `${event.timestamp}|${event.id}`;
}

