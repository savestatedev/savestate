/**
 * Action Recall Drillbook
 * 
 * Pre-action memory reliability gate that tests high-risk facts
 * before costly actions, with source-anchored repair.
 * 
 * Features:
 * - Emit drill items on meaningful actions (decisions, side effects, etc.)
 * - Sample-based test protocol (5-8 items, <=20s)
 * - Weighted sampling (importance, miss history, age, change risk)
 * - Readiness policy by action cost level
 * - Miss handling with source retrieval and repair
 * 
 * @see https://github.com/savestatedev/savestate/issues/73
 */

// Types
export {
  // Drill items
  EmittingAction,
  DrillItem,
  InvalidationCondition,
  TestResult,
  CreateDrillInput,
  
  // Test protocol
  TestProtocolConfig,
  SamplingWeights,
  TestSession,
  DEFAULT_PROTOCOL_CONFIG,
  DEFAULT_SAMPLING_WEIGHTS,
  
  // Readiness
  ActionCostLevel,
  ReadinessThresholds,
  ReadinessResult,
  DEFAULT_READINESS_THRESHOLDS,
  
  // Miss handling
  MissRepair,
  
  // Storage
  DrillbookStorage,
} from './types.js';

// Drillbook service
export { Drillbook } from './drillbook.js';

// Storage backends
export { InMemoryDrillbookStorage } from './storage/index.js';
