/**
 * CLI Commands for Preflight Context Compiler
 * Issue #54: compile, explain, validate commands
 */

import { existsSync, readFileSync } from 'node:fs';
import { Command } from 'commander';
import {
  ContextCompiler,
  CompileRequest,
  DEFAULT_BUDGET_ALLOCATION,
  DEFAULT_SCORING_WEIGHTS,
  type BudgetAllocation,
  type ExplanationTrace,
  type RunBrief,
  type ScoringWeights,
  type ValidationResult,
} from '../context/index.js';
import { Candidate } from '../context/scorer.js';

export interface ContextCompileJson {
  runId: string;
  compiledAt: string;
  tokenCount: number;
  budgetRemaining: number;
  mustKnowFacts: number;
  activeState: number;
  openLoops: number;
  constraints: number;
  recentDecisions: number;
  conflicts: number;
  unknowns: number;
  citations: number;
}

export interface ContextConfigJson {
  weights: ScoringWeights;
  budget: BudgetAllocation;
}

export interface ContextExplainCandidateJson {
  id: string;
  included: boolean;
  score: number;
  reason: string;
}

export interface ContextExplainJson {
  runId: string;
  compiledAt: string;
  totalCandidates: number;
  included: number;
  excluded: number;
  budget: {
    mustKnowFacts: number;
    constraints: number;
    openLoops: number;
    activeState: number;
    recentDecisions: number;
    conflicts: number;
    unknowns: number;
    citations: number;
  };
  shown: number;
  candidates: ContextExplainCandidateJson[];
}

export interface ContextExplainMissingJson {
  found: false;
  runId: string;
  compiledAt: null;
  totalCandidates: 0;
  included: 0;
  excluded: 0;
}

export interface ContextValidateJson {
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  coverage: {
    constraintsCovered: number;
    constraintsTotal: number;
    requiredFactsPresent: boolean;
  };
}

const EXPLAIN_CANDIDATE_LIMIT = 10;

export function formatContextCompileJson(brief: RunBrief): string {
  const record: ContextCompileJson = {
    runId: brief.run_id,
    compiledAt: brief.compiled_at,
    tokenCount: brief.token_count,
    budgetRemaining: brief.budget_remaining,
    mustKnowFacts: brief.must_know_facts.length,
    activeState: Object.keys(brief.active_state).length,
    openLoops: brief.open_loops.length,
    constraints: brief.constraints.length,
    recentDecisions: brief.recent_decisions.length,
    conflicts: brief.conflicts.length,
    unknowns: brief.unknowns.length,
    citations: brief.citations.length,
  };
  return JSON.stringify(record, null, 2);
}

export function formatContextConfigJson(): string {
  const record: ContextConfigJson = {
    weights: DEFAULT_SCORING_WEIGHTS,
    budget: DEFAULT_BUDGET_ALLOCATION,
  };
  return JSON.stringify(record, null, 2);
}

export function formatContextValidateJson(
  file: string,
  result: ValidationResult,
): string {
  const record: ContextValidateJson = {
    file,
    valid: result.valid,
    errors: [...result.errors],
    warnings: [...result.warnings],
    coverage: {
      constraintsCovered: result.coverage.constraints_covered,
      constraintsTotal: result.coverage.constraints_total,
      requiredFactsPresent: result.coverage.required_facts_present,
    },
  };
  return JSON.stringify(record, null, 2);
}

export function formatContextExplainJson(explanation: ExplanationTrace): string {
  const candidates = explanation.candidates.slice(0, EXPLAIN_CANDIDATE_LIMIT).map((candidate) => ({
    id: candidate.candidate_id,
    included: candidate.included,
    score: candidate.score,
    reason: candidate.reason,
  }));
  const record: ContextExplainJson = {
    runId: explanation.run_id,
    compiledAt: explanation.compiled_at,
    totalCandidates: explanation.total_candidates,
    included: explanation.included_count,
    excluded: explanation.excluded_count,
    budget: {
      mustKnowFacts: explanation.budget_allocation.must_know_facts,
      constraints: explanation.budget_allocation.constraints,
      openLoops: explanation.budget_allocation.open_loops,
      activeState: explanation.budget_allocation.active_state,
      recentDecisions: explanation.budget_allocation.recent_decisions,
      conflicts: explanation.budget_allocation.conflicts,
      unknowns: explanation.budget_allocation.unknowns,
      citations: explanation.budget_allocation.citations,
    },
    shown: candidates.length,
    candidates,
  };
  return JSON.stringify(record, null, 2);
}

export function formatContextExplainMissingJson(runId: string): string {
  return JSON.stringify(
    {
      found: false,
      runId,
      compiledAt: null,
      totalCandidates: 0,
      included: 0,
      excluded: 0,
    },
    null,
    2,
  );
}

export function registerContextCommands(program: Command): void {
  const context = program
    .command('context')
    .description('Preflight context compilation for agent runs');

  // Compile command
  context
    .command('compile')
    .description('Compile context for an agent run')
    .requiredOption('-a, --agent <id>', 'Agent ID')
    .requiredOption('-t, --task <intent>', 'Task intent/description')
    .option('-b, --budget <tokens>', 'Token budget', '4000')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const compiler = new ContextCompiler();
      
      const request: CompileRequest = {
        agent_id: options.agent,
        task: { intent: options.task },
        token_budget: parseInt(options.budget, 10),
      };
      
      // TODO: Load actual candidates from memory store
      // For now, use empty candidates
      const candidates: Candidate[] = [];

      if (!options.json) {
        console.log(`Compiling context for agent "${options.agent}"...`);
        console.log(`Task: ${options.task}`);
        console.log(`Budget: ${options.budget} tokens`);
        console.log('');
      }

      const result = await compiler.compile(request, candidates);

      if (options.json) {
        console.log(formatContextCompileJson(result.brief));
        return;
      }

      console.log('📋 RunBrief Compiled');
      console.log(`   Run ID: ${result.brief.run_id}`);
      console.log(`   Compiled: ${result.brief.compiled_at}`);
      console.log(`   Token Count: ${result.brief.token_count}`);
      console.log(`   Budget Remaining: ${result.brief.budget_remaining}`);
      console.log('');
      console.log('📊 Sections:');
      console.log(`   Must-Know Facts: ${result.brief.must_know_facts.length}`);
      console.log(`   Active State: ${Object.keys(result.brief.active_state).length} entities`);
      console.log(`   Open Loops: ${result.brief.open_loops.length}`);
      console.log(`   Constraints: ${result.brief.constraints.length}`);
      console.log(`   Recent Decisions: ${result.brief.recent_decisions.length}`);
      console.log(`   Conflicts: ${result.brief.conflicts.length}`);
      console.log(`   Citations: ${result.brief.citations.length}`);
    });

  // Explain command
  context
    .command('explain <run-id>')
    .description('Get explanation trace for a compiled context')
    .option('--json', 'Output as JSON')
    .action((runId: string, options) => {
      const compiler = new ContextCompiler();
      const explanation = compiler.getExplanation(runId);
      
      if (!explanation) {
        if (options.json) {
          console.log(formatContextExplainMissingJson(runId));
          return;
        }
        console.error(`❌ No explanation found for run ID: ${runId}`);
        process.exit(1);
      }
      
      if (options.json) {
        console.log(formatContextExplainJson(explanation));
        return;
      }

      console.log('📝 Explanation Trace');
      console.log(`   Run ID: ${explanation.run_id}`);
      console.log(`   Compiled: ${explanation.compiled_at}`);
      console.log(`   Total Candidates: ${explanation.total_candidates}`);
      console.log(`   Included: ${explanation.included_count}`);
      console.log(`   Excluded: ${explanation.excluded_count}`);
      console.log('');
      console.log('📊 Budget Allocation:');
      for (const [section, tokens] of Object.entries(explanation.budget_allocation)) {
        console.log(`   ${section}: ${tokens} tokens`);
      }
      console.log('');
      console.log('🔍 Top Candidates:');
      for (const c of explanation.candidates.slice(0, 10)) {
        const status = c.included ? '✅' : '❌';
        console.log(`   ${status} ${c.candidate_id} (score: ${c.score.toFixed(3)})`);
        console.log(`      ${c.reason}`);
      }
    });

  // Validate command
  context
    .command('validate')
    .description('Validate a RunBrief')
    .option('-f, --file <path>', 'Path to RunBrief JSON file')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const filePath = options.file as string | undefined;
      if (!filePath) {
        console.error('Validation requires a RunBrief file (--file)');
        console.error('Usage: savestate context validate --file brief.json');
        process.exit(1);
      }

      if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
      }

      let brief: RunBrief;
      try {
        brief = JSON.parse(readFileSync(filePath, 'utf-8')) as RunBrief;
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      const compiler = new ContextCompiler();
      const result = compiler.validate(brief);

      if (options.json) {
        console.log(formatContextValidateJson(filePath, result));
        if (!result.valid) process.exit(1);
        return;
      }

      console.log(result.valid ? 'Valid RunBrief' : 'Invalid RunBrief');
      console.log(`File: ${filePath}`);
      if (result.errors.length > 0) {
        console.log('Errors:');
        for (const error of result.errors) {
          console.log(`  ${error}`);
        }
      }
      if (result.warnings.length > 0) {
        console.log('Warnings:');
        for (const warning of result.warnings) {
          console.log(`  ${warning}`);
        }
      }
      console.log(
        `Coverage: constraints ${result.coverage.constraints_covered}/${result.coverage.constraints_total}, required facts ${result.coverage.required_facts_present ? 'present' : 'missing'}`,
      );
      if (!result.valid) process.exit(1);
    });

  // Config command
  context
    .command('config')
    .description('View/edit compiler configuration')
    .option('--weights', 'Show scoring weights')
    .option('--budget', 'Show budget allocation')
    .option('--json', 'Output as JSON')
    .action((options) => {
      if (options.json) {
        console.log(formatContextConfigJson());
        return;
      }
      
      if (options.weights || (!options.weights && !options.budget)) {
        console.log('⚖️ Scoring Weights:');
        for (const [key, value] of Object.entries(DEFAULT_SCORING_WEIGHTS)) {
          console.log(`   ${key}: ${value}`);
        }
        console.log('');
      }
      
      if (options.budget || (!options.weights && !options.budget)) {
        console.log('💰 Budget Allocation:');
        for (const [key, value] of Object.entries(DEFAULT_BUDGET_ALLOCATION)) {
          const percent = ((value as number) * 100).toFixed(0);
          console.log(`   ${key}: ${percent}%`);
        }
      }
    });
}
