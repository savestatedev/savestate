import { Command } from 'commander';
import { proposeCommitment, verifyCommitment, gateAction, listCommitments } from '../acl/index.js';

async function aclPropose(options: {
  type: string;
  criticality: string;
  description: string;
  proposer: string;
  expiresIn?: string;
}) {
  try {
    let expiresAt: string | undefined;
    if (options.expiresIn) {
      const ms = parseInt(options.expiresIn) * 1000; // minutes to ms
      expiresAt = new Date(Date.now() + ms).toISOString();
    }

    const commitment = proposeCommitment({
      type: options.type as any,
      criticality: options.criticality as any,
      description: options.description,
      proposer: options.proposer,
      expiresAt,
    });

    console.log(`Commitment proposed: ${commitment.id}`);
    console.log(`State: ${commitment.state}`);
    console.log(`Criticality: ${commitment.criticality}`);
    console.log(`Expires: ${commitment.expiresAt || 'Never'}`);
  } catch (error: any) {
    console.error('Error proposing commitment:', error.message);
    process.exit(1);
  }
}

async function aclVerify(options: { id: string; verifier: string; approve: boolean }) {
  try {
    const commitment = verifyCommitment(options.id, options.verifier, options.approve);
    if (!commitment) {
      console.error('Commitment not found:', options.id);
      process.exit(1);
    }
    console.log(`Commitment ${options.id} is now: ${commitment.state}`);
    console.log(`Verified by: ${commitment.verifier}`);
  } catch (error: any) {
    console.error('Error verifying commitment:', error.message);
    process.exit(1);
  }
}

async function aclGate(options: { action: string }) {
  try {
    const result = gateAction(options.action as any);
    if (result.allowed) {
      console.log(`✅ Action '${options.action}' is ALLOWED`);
      process.exit(0);
    } else {
      console.log(`❌ Action '${options.action}' is BLOCKED`);
      console.log(`Reason: ${result.reason}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Error gating action:', error.message);
    process.exit(1);
  }
}

async function aclList() {
  try {
    const commitments = listCommitments();
    if (commitments.length === 0) {
      console.log('No commitments found.');
      return;
    }
    console.log(`Found ${commitments.length} commitment(s):\n`);
    commitments.forEach((c) => {
      console.log(`ID: ${c.id}`);
      console.log(`  Type: ${c.type} (${c.criticality})`);
      console.log(`  State: ${c.state}`);
      console.log(`  Description: ${c.description}`);
      console.log('');
    });
  } catch (error: any) {
    console.error('Error listing commitments:', error.message);
    process.exit(1);
  }
}

export function registerACLCommands(program: Command) {
  const acl = program
    .command('acl')
    .description('Manage active commitments (ACL).');

  acl
    .command('propose')
    .description('Propose a new commitment.')
    .requiredOption('-t, --type <type>', 'Commitment type (customer_promise, ticket_status_change, escalation_closure, account_tool_write)')
    .requiredOption('-c, --criticality <level>', 'Criticality level (c1, c2, c3)')
    .requiredOption('-d, --description <text>', 'Description of the commitment')
    .requiredOption('-p, --proposer <id>', 'ID of the proposing agent')
    .option('-e, --expires-in <minutes>', 'Minutes until expiration')
    .action(aclPropose);

  acl
    .command('verify')
    .description('Verify or reject a commitment.')
    .requiredOption('-i, --id <id>', 'Commitment ID')
    .requiredOption('-v, --verifier <id>', 'ID of the verifier')
    .option('-a, --approve', 'Approve the commitment (default is reject)', false)
    .action(aclVerify);

  acl
    .command('gate')
    .description('Check if an action is allowed based on active commitments.')
    .requiredOption('-a, --action <type>', 'Action type to check')
    .action(aclGate);

  acl
    .command('list')
    .description('List all commitments.')
    .action(aclList);
}
