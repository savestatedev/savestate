import { Command } from 'commander';
import {
  proposeCommitment,
  verifyCommitment,
  gateAction,
  listCommitments,
  type Commitment,
} from '../acl/index.js';

export interface AclCommitmentJson {
  id: string;
  type: string;
  criticality: string;
  state: string;
  description: string;
  proposer: string;
  verifier: string | null;
  expiresAt: string | null;
}

export interface AclGateResult {
  allowed: boolean;
  action: string;
  reason: string | null;
}

function toCommitmentJson(commitment: Commitment): AclCommitmentJson {
  return {
    id: commitment.id,
    type: commitment.type,
    criticality: commitment.criticality,
    state: commitment.state,
    description: commitment.description,
    proposer: commitment.proposer,
    verifier: commitment.verifier ?? null,
    expiresAt: commitment.expiresAt ?? null,
  };
}

export function formatAclCommitmentJson(commitment: Commitment): string {
  return JSON.stringify(toCommitmentJson(commitment), null, 2);
}

export function formatAclListJson(commitments: Commitment[]): string {
  return JSON.stringify(commitments.map(toCommitmentJson), null, 2);
}

export function formatAclGateJson(result: AclGateResult): string {
  return JSON.stringify(
    {
      allowed: result.allowed,
      action: result.action,
      reason: result.reason,
    },
    null,
    2,
  );
}

export interface AclVerifyMissingJson {
  found: false;
  id: string;
  state: null;
  verifier: null;
}

export function formatAclVerifyMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      state: null,
      verifier: null,
    },
    null,
    2,
  );
}

const MAX_ACL_EXPIRES_IN_MINUTES = 10080;

/** Parse --expires-in as minutes so invalid input cannot write NaN or second-scale expirations. */
export function parseAclExpiresIn(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_ACL_EXPIRES_IN_MINUTES) {
    throw new Error(
      `Invalid --expires-in value "${value}". Expected a positive integer up to ${MAX_ACL_EXPIRES_IN_MINUTES}.`,
    );
  }
  return minutes;
}

async function aclPropose(options: {
  type: string;
  criticality: string;
  description: string;
  proposer: string;
  expiresIn?: string;
  json?: boolean;
}) {
  try {
    let expiresAt: string | undefined;
    const minutes = parseAclExpiresIn(options.expiresIn);
    if (minutes !== undefined) {
      expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    }

    const commitment = proposeCommitment({
      type: options.type as any,
      criticality: options.criticality as any,
      description: options.description,
      proposer: options.proposer,
      expiresAt,
    });

    if (options.json) {
      console.log(formatAclCommitmentJson(commitment));
      return;
    }

    console.log(`Commitment proposed: ${commitment.id}`);
    console.log(`State: ${commitment.state}`);
    console.log(`Criticality: ${commitment.criticality}`);
    console.log(`Expires: ${commitment.expiresAt || 'Never'}`);
  } catch (error: any) {
    console.error('Error proposing commitment:', error.message);
    process.exit(1);
  }
}

async function aclVerify(options: { id: string; verifier: string; approve: boolean; json?: boolean }) {
  try {
    const commitment = verifyCommitment(options.id, options.verifier, options.approve);
    if (!commitment) {
      if (options.json) {
        console.log(formatAclVerifyMissingJson(options.id));
        return;
      }
      console.error('Commitment not found:', options.id);
      process.exit(1);
    }
    if (options.json) {
      console.log(formatAclCommitmentJson(commitment));
      return;
    }
    console.log(`Commitment ${options.id} is now: ${commitment.state}`);
    console.log(`Verified by: ${commitment.verifier}`);
  } catch (error: any) {
    console.error('Error verifying commitment:', error.message);
    process.exit(1);
  }
}

async function aclGate(options: { action: string; json?: boolean }) {
  try {
    const result = gateAction(options.action as any);
    if (options.json) {
      console.log(
        formatAclGateJson({
          allowed: result.allowed,
          action: options.action,
          reason: result.reason ?? null,
        }),
      );
      process.exit(result.allowed ? 0 : 1);
    }
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

async function aclList(options: { json?: boolean } = {}) {
  try {
    const commitments = listCommitments();
    if (options.json) {
      console.log(formatAclListJson(commitments));
      return;
    }
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
    .option('--json', 'Output as JSON')
    .action(aclPropose);

  acl
    .command('verify')
    .description('Verify or reject a commitment.')
    .requiredOption('-i, --id <id>', 'Commitment ID')
    .requiredOption('-v, --verifier <id>', 'ID of the verifier')
    .option('-a, --approve', 'Approve the commitment (default is reject)', false)
    .option('--json', 'Output as JSON')
    .action(aclVerify);

  acl
    .command('gate')
    .description('Check if an action is allowed based on active commitments.')
    .requiredOption('-a, --action <type>', 'Action type to check')
    .option('--json', 'Output as JSON')
    .action(aclGate);

  acl
    .command('list')
    .description('List all commitments.')
    .option('--json', 'Output as JSON')
    .action(aclList);
}
