/**
 * Failure Antibody System (MVP) types
 */

export type Intervention = 'warn' | 'block' | 'confirm';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SafeActionType =
  | 'retry_with_backoff'
  | 'check_permissions'
  | 'validate_inputs'
  | 'run_read_only_probe'
  | 'confirm_with_user';

export interface SafeAction {
  type: SafeActionType;
  params?: Record<string, string | number | boolean>;
}

export type FailureEvent = UserCorrectionEvent | ToolFailureEvent;

export interface FailureEventBase {
  id: string;
  timestamp: string;
  tool?: string;
  path?: string;
  tags?: string[];
}

export interface UserCorrectionEvent extends FailureEventBase {
  type: 'user_correction';
  correction_code: 'wrong_path' | 'missing_permission' | 'unsafe_write' | 'wrong_tool' | 'other';
  error_code?: string;
  risk?: RiskLevel;
  safe_action?: SafeAction;
}

export interface ToolFailureEvent extends FailureEventBase {
  type: 'tool_failure';
  error_code: string;
  hard: boolean;
  exit_code?: number;
}

export interface AntibodyTrigger {
  tool?: string;
  error_codes?: string[];
  path_prefixes?: string[];
  tags?: string[];
}

export interface AntibodyScope {
  project?: string;
  adapters?: string[];
  tags?: string[];
}

export interface AntibodyRule {
  id: string;
  trigger: AntibodyTrigger;
  risk: RiskLevel;
  safe_action: SafeAction;
  scope: AntibodyScope;
  confidence: number;
  intervention: Intervention;
  created_at: string;
  retired_at?: string;
  source_event_ids: string[];
  hits: number;
  overrides: number;
}

export interface AntibodyStoreFile {
  version: 1;
  rules: AntibodyRule[];
}

export interface AntibodyStats {
  total_rules: number;
  active_rules: number;
  retired_rules: number;
  total_hits: number;
  total_overrides: number;
  rules: Array<{
    id: string;
    risk: RiskLevel;
    intervention: Intervention;
    active: boolean;
    confidence: number;
    hits: number;
    overrides: number;
  }>;
}

export interface PreflightContext {
  tool?: string;
  error_code?: string;
  path?: string;
  tags?: string[];
  semantic_text?: string;
}

export interface PreflightWarning {
  rule_id: string;
  intervention: Intervention;
  risk: RiskLevel;
  safe_action: SafeAction;
  confidence: number;
  reason_codes: Array<'tool' | 'error_code' | 'path_prefix' | 'tag' | 'semantic'>;
}

export interface PreflightResult {
  warnings: PreflightWarning[];
  blocked: boolean;
  elapsed_ms: number;
  semantic_used: boolean;
  matched_rule_ids: string[];
}
