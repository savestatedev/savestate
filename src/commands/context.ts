/**
 * CLI Commands for Preflight Context Compiler
 * Issue #54: compile, explain, validate commands
 */

import { Command } from 'commander';
import { ContextCompiler, CompileRequest } from '../context/index.js';
import { Candidate } from '../context/scorer.js';

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
      
      console.log(`Compiling context for agent "${options.agent}"...`);
      console.log(`Task: ${options.task}`);
      console.log(`Budget: ${options.budget} tokens`);
      console.log('');
      
      const result = await compiler.compile(request, candidates);
      
      if (options.json) {
        console.log(JSON.stringify(result.brief, null, 2));
      } else {
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
      }
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
        console.error(`❌ No explanation found for run ID: ${runId}`);
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(explanation, null, 2));
      } else {
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
      }
    });

  // Validate command
  context
    .command('validate')
    .description('Validate a RunBrief')
    .option('-f, --file <path>', 'Path to RunBrief JSON file')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const compiler = new ContextCompiler();
      
      // TODO: Load RunBrief from file
      console.log('Validation requires a RunBrief file (--file)');
      console.log('Usage: savestate context validate --file brief.json');
    });

  // Config command
  context
    .command('config')
    .description('View/edit compiler configuration')
    .option('--weights', 'Show scoring weights')
    .option('--budget', 'Show budget allocation')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const { DEFAULT_SCORING_WEIGHTS, DEFAULT_BUDGET_ALLOCATION } = require('../context/types.js');
      
      if (options.json) {
        console.log(JSON.stringify({
          weights: DEFAULT_SCORING_WEIGHTS,
          budget: DEFAULT_BUDGET_ALLOCATION,
        }, null, 2));
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
