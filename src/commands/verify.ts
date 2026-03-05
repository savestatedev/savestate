/**
 * savestate verify — Verify integrity of a .savestate container
 *
 * Issue #155: User Story: State file integrity verification
 */

import chalk from 'chalk';
import { verifyContainer } from '../container/operations.js';

export async function verifyCommand(filePath: string, options: { passphrase?: string } = {}): Promise<void> {
  const passphrase = options.passphrase || process.env.SAVESTATE_PASSPHRASE;

  if (!passphrase) {
    console.error(
      chalk.red('✗ Passphrase required to verify encryption.') +
        ' Provide --passphrase or set SAVESTATE_PASSPHRASE env var.'
    );
    process.exit(1);
  }

  const result = verifyContainer(filePath, passphrase);

  if (result.status === 'valid') {
    console.log(chalk.green('✅ State file is valid'));
    if (result.metadata) {
      console.log(chalk.dim(`   Agent: ${result.metadata.agent_name}`));
      console.log(chalk.dim(`   Schema: ${result.metadata.schema_version}`));
      console.log(chalk.dim(`   Created: ${result.metadata.created_at}`));
    }
    return;
  }

  if (result.status === 'wrong_password') {
    console.error(chalk.yellow('⚠ Wrong password (cannot decrypt)'));
    process.exit(2);
  }

  console.error(chalk.red('❌ State file is corrupted or invalid'));
  result.errors.forEach((e) => console.error(chalk.dim(`   - ${e}`)));
  process.exit(1);
}
