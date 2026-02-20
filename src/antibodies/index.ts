/**
 * Failure Antibody System (MVP)
 */

export type {
  Intervention,
  RiskLevel,
  SafeActionType,
  SafeAction,
  FailureEvent,
  FailureEventBase,
  UserCorrectionEvent,
  ToolFailureEvent,
  AntibodyTrigger,
  AntibodyScope,
  AntibodyRule,
  AntibodyStoreFile,
  AntibodyStats,
  PreflightContext,
  PreflightWarning,
  PreflightResult,
} from './types.js';

export { AntibodyStore } from './store.js';
export type { ListRulesOptions } from './store.js';

export { AntibodyCompiler, deriveRuleId } from './compiler.js';

export { AntibodyEngine } from './engine.js';
export type { AntibodyEngineOptions, PreflightOptions } from './engine.js';

