/**
 * CLI Commands for Portable Container
 * Issue #104: export, import, validate, info commands
 */

import { Command } from 'commander';
import { 
  exportContainer, 
  importContainer, 
  validateContainer,
  getContainerInfo,
  ExportOptions 
} from '../container/operations.js';
import { createEmptyAgentState, AgentState } from '../container/schema.js';
import { CONTAINER_FILE_EXTENSION } from '../container/format.js';

export function registerContainerCommands(program: Command): void {
  const container = program
    .command('container')
    .description('Manage portable state containers');

  // Export command
  program
    .command('export <agent-id>')
    .description('Export agent state to encrypted .savestate container')
    .option('-o, --output <path>', 'Output file path', `agent${CONTAINER_FILE_EXTENSION}`)
    .option('-p, --passphrase <passphrase>', 'Encryption passphrase (or use SAVESTATE_PASSPHRASE env)')
    .option('-d, --description <description>', 'Container description')
    .action(async (agentId: string, options) => {
      const passphrase = options.passphrase || process.env.SAVESTATE_PASSPHRASE;
      
      if (!passphrase) {
        console.error('Error: Passphrase required. Use --passphrase or set SAVESTATE_PASSPHRASE env var.');
        process.exit(1);
      }

      console.log(`Exporting agent "${agentId}" to ${options.output}...`);

      // TODO: Load actual agent state from SaveState storage
      // For now, create a placeholder state
      const state: AgentState = createEmptyAgentState(agentId);
      
      const exportOpts: ExportOptions = {
        agentId,
        passphrase,
        outputPath: options.output,
        description: options.description,
      };

      const result = await exportContainer(state, exportOpts);

      if (result.success) {
        console.log(`✅ Successfully exported to ${result.path}`);
      } else {
        console.error(`❌ Export failed: ${result.error}`);
        process.exit(1);
      }
    });

  // Import command
  program
    .command('import <path>')
    .description('Import agent state from encrypted .savestate container')
    .option('-p, --passphrase <passphrase>', 'Decryption passphrase (or use SAVESTATE_PASSPHRASE env)')
    .option('-a, --agent-id <id>', 'Target agent ID (defaults to original agent name)')
    .action(async (filePath: string, options) => {
      const passphrase = options.passphrase || process.env.SAVESTATE_PASSPHRASE;
      
      if (!passphrase) {
        console.error('Error: Passphrase required. Use --passphrase or set SAVESTATE_PASSPHRASE env var.');
        process.exit(1);
      }

      console.log(`Importing from ${filePath}...`);

      const result = await importContainer({
        filePath,
        passphrase,
        targetAgentId: options.agentId,
      });

      if (result.success) {
        console.log(`✅ Successfully imported agent "${result.agentId}"`);
        console.log(`   Memories: ${result.state?.memories?.length || 0}`);
        console.log(`   Preferences: ${Object.keys(result.state?.preferences || {}).length}`);
        console.log(`   History: ${result.state?.history?.length || 0} messages`);
      } else {
        console.error(`❌ Import failed: ${result.error}`);
        process.exit(1);
      }
    });

  // Validate command
  container
    .command('validate <path>')
    .description('Validate a .savestate container without decrypting')
    .action((filePath: string) => {
      console.log(`Validating ${filePath}...`);

      const result = validateContainer(filePath);

      if (result.valid) {
        console.log('✅ Container is valid');
        if (result.metadata) {
          console.log(`   Agent: ${result.metadata.agent_name}`);
          console.log(`   Schema: ${result.metadata.schema_version}`);
          console.log(`   Created: ${result.metadata.created_at}`);
        }
      } else {
        console.error('❌ Container validation failed:');
        result.errors.forEach(err => console.error(`   - ${err}`));
        process.exit(1);
      }
    });

  // Info command
  container
    .command('info <path>')
    .description('Show container metadata without decrypting')
    .option('--json', 'Output as JSON')
    .action((filePath: string, options) => {
      const metadata = getContainerInfo(filePath);

      if (!metadata) {
        console.error('❌ Could not read container metadata');
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(metadata, null, 2));
      } else {
        console.log('📦 Container Info:');
        console.log(`   Agent Name:    ${metadata.agent_name}`);
        console.log(`   Schema Version: ${metadata.schema_version}`);
        console.log(`   Created By:    ${metadata.created_by}`);
        console.log(`   Created At:    ${metadata.created_at}`);
        if (metadata.description) {
          console.log(`   Description:   ${metadata.description}`);
        }
      }
    });
}
