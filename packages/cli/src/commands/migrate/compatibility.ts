/**
 * Compatibility Report Generator - CLI Command Module
 *
 * Re-exports the core compatibility analyzer from src/migrate/compatibility.ts
 * This file exists to satisfy the packages/cli path structure for CLI commands.
 */

// Re-export everything from the core implementation
export {
  CompatibilityAnalyzer,
  analyzeCompatibility,
  formatReport,
  formatReportJson,
  generateRecommendations,
  compatibilityCommand,
  type CompatibilityReportOptions,
  type CompatibilityCommandOptions,
} from '../../../../../src/migrate/compatibility.js';
