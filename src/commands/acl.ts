import { Command } from 'commander';
import {
  proposeCommitment,
  verifyCommitment,
  gateAction,
  listCommitments,
  type Commitment,
  type CommitmentState,
  type Criticality,
  type CommitmentType,
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

export interface AclListJsonSummary {
  found: boolean;
  total: number;
  shown: number;
  remaining: number;
  emptyReason: 'collection' | 'page' | null;
  offset: number;
  maxOffset: number;
  limit: number | null;
  pageSize: number | null;
  state: CommitmentState | null;
  type: CommitmentType | null;
  criticality: Criticality | null;
  proposer: string | null;
  page: number;
  totalPages: number;
  hasPrevious: boolean;
  previousOffset: number | null;
  hasMore: boolean;
  nextOffset: number | null;
  suggestedOffset: number | null;
  entries: AclCommitmentJson[];
}

/** Include page state for scripts without changing the legacy --json array shape. */
export function formatAclListJsonSummary(
  commitments: Commitment[],
  offset = 0,
  limit?: number,
  state?: CommitmentState,
  type?: CommitmentType,
  criticality?: Criticality,
  proposer?: string,
): string {
  const page = limit === undefined
    ? commitments.slice(offset)
    : commitments.slice(offset, offset + limit);
  const suggestedOffset = suggestAclListOffset(commitments.length, page.length, limit);
  const pageEnd = offset + page.length;
  // Never advertise a continuation that parseAclOffset will reject.
  const hasMore = limit !== undefined
    && pageEnd < commitments.length
    && pageEnd <= MAX_ACL_OFFSET;
  const totalPages = limit === undefined
    ? commitments.length > 0 ? 1 : 0
    : Math.min(
      Math.ceil(commitments.length / limit),
      Math.floor(MAX_ACL_OFFSET / limit) + 1,
    );
  const result: AclListJsonSummary = {
    found: page.length > 0,
    total: commitments.length,
    shown: page.length,
    remaining: Math.max(0, commitments.length - offset - page.length),
    emptyReason: page.length > 0 ? null : commitments.length === 0 ? 'collection' : 'page',
    offset,
    maxOffset: MAX_ACL_OFFSET,
    limit: limit ?? null,
    pageSize: limit ?? null,
    state: state ?? null,
    type: type ?? null,
    criticality: criticality ?? null,
    proposer: proposer ?? null,
    page: limit === undefined
      ? commitments.length > 0 ? 1 : 0
      : Math.floor(offset / limit) + 1,
    totalPages,
    hasPrevious: offset > 0,
    previousOffset: offset > 0
      ? suggestedOffset !== null
        ? suggestedOffset
        : Math.max(0, offset - (limit ?? offset))
      : null,
    hasMore,
    nextOffset: hasMore ? pageEnd : null,
    suggestedOffset,
    entries: page.map(toCommitmentJson),
  };
  return JSON.stringify(result, null, 2);
}

/** Find the nearest populated page when a bounded ACL page is past the collection. */
export function suggestAclListOffset(
  total: number,
  shown: number,
  limit: number | undefined,
): number | null {
  if (shown !== 0 || total === 0) return null;
  // An offset-only request returns every remaining commitment, so the only
  // populated recovery page is the collection start.
  if (limit === undefined) return 0;
  return Math.min(Math.floor((total - 1) / limit) * limit, MAX_ACL_OFFSET);
}

export function formatAclListHeading(
  count: number,
  offset: number | undefined,
  limit: number | undefined,
  state?: CommitmentState,
  type?: CommitmentType,
  criticality?: Criticality,
  proposer?: string,
): string {
  const paging = [
    offset === undefined ? undefined : `skipped ${offset}`,
    limit === undefined ? undefined : `limit ${limit}`,
    state === undefined ? undefined : `state ${state}`,
    type === undefined ? undefined : `type ${type}`,
    criticality === undefined ? undefined : `criticality ${criticality}`,
    proposer === undefined ? undefined : `proposer ${proposer}`,
  ].filter((value): value is string => value !== undefined);
  const suffix = paging.length > 0 ? ` (${paging.join(', ')})` : '';
  return `Found ${count} commitment(s)${suffix}:`;
}

export function formatAclListEmpty(
  offset: number | undefined,
  limit: number | undefined,
  suggestedOffset: number | null = null,
  state?: CommitmentState,
  type?: CommitmentType,
  criticality?: Criticality,
  proposer?: string,
): string {
  const paging = [
    offset === undefined ? undefined : `skipped ${offset}`,
    limit === undefined ? undefined : `limit ${limit}`,
    state === undefined ? undefined : `state ${state}`,
    type === undefined ? undefined : `type ${type}`,
    criticality === undefined ? undefined : `criticality ${criticality}`,
    proposer === undefined ? undefined : `proposer ${proposer}`,
  ].filter((value): value is string => value !== undefined);
  const suffix = paging.length > 0 ? ` (${paging.join(', ')})` : '';
  const recovery = suggestedOffset === null
    ? ''
    : ` Try --offset ${suggestedOffset} to open the nearest available page.`;
  return `No commitments found${suffix}.${recovery}`;
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
const ACL_CRITICALITIES = ['c1', 'c2', 'c3'] as const;
const ACL_CRITICALITY_LIST = ACL_CRITICALITIES.join(', ');

/** Parse --criticality so invalid input cannot write an untyped commitment. */
export function parseAclCriticality(value: string | undefined): Criticality {
  if (value === undefined) {
    throw new Error(
      `Invalid --criticality value. Expected one of: ${ACL_CRITICALITY_LIST}.`,
    );
  }

  const normalized = value.trim().toLowerCase();
  if ((ACL_CRITICALITIES as readonly string[]).includes(normalized)) {
    return normalized as Criticality;
  }

  throw new Error(
    `Invalid --criticality value "${value}". Expected one of: ${ACL_CRITICALITY_LIST}.`,
  );
}

const ACL_TYPES = [
  'customer_promise',
  'ticket_status_change',
  'escalation_closure',
  'account_tool_write',
] as const;
const ACL_TYPE_LIST = ACL_TYPES.join(', ');

/** Parse --type so invalid input cannot write an untyped commitment. */
export function parseAclType(value: string | undefined): CommitmentType {
  if (value === undefined) {
    throw new Error(
      `Invalid --type value. Expected one of: ${ACL_TYPE_LIST}.`,
    );
  }

  const normalized = value.trim().toLowerCase();
  if ((ACL_TYPES as readonly string[]).includes(normalized)) {
    return normalized as CommitmentType;
  }

  throw new Error(
    `Invalid --type value "${value}". Expected one of: ${ACL_TYPE_LIST}.`,
  );
}

/** Parse --action so invalid input cannot gate an untyped commitment action. */
export function parseAclAction(value: string | undefined): CommitmentType {
  if (value === undefined) {
    throw new Error(
      `Invalid --action value. Expected one of: ${ACL_TYPE_LIST}.`,
    );
  }

  const normalized = value.trim().toLowerCase();
  if ((ACL_TYPES as readonly string[]).includes(normalized)) {
    return normalized as CommitmentType;
  }

  throw new Error(
    `Invalid --action value "${value}". Expected one of: ${ACL_TYPE_LIST}.`,
  );
}

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

/** Parse acl --id without treating blank or comma-separated values as a commitment id. */
export function parseAclId(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid --id value. Expected a single non-empty commitment id.',
    );
  }

  const id = value.trim();
  if (id.length === 0 || id.includes(',') || /\s/.test(id)) {
    throw new Error(
      `Invalid --id value "${value}". Expected a single non-empty commitment id.`,
    );
  }

  return id;
}

/** Parse acl --proposer without treating blank or comma-separated values as a proposer id. */
export function parseAclProposer(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid --proposer value. Expected a single non-empty proposer id.',
    );
  }

  const proposer = value.trim();
  if (proposer.length === 0 || proposer.includes(',') || /\s/.test(proposer)) {
    throw new Error(
      `Invalid --proposer value "${value}". Expected a single non-empty proposer id.`,
    );
  }

  return proposer;
}

/** Parse acl --verifier without treating blank or comma-separated values as a verifier id. */
export function parseAclVerifier(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid --verifier value. Expected a single non-empty verifier id.',
    );
  }

  const verifier = value.trim();
  if (verifier.length === 0 || verifier.includes(',') || /\s/.test(verifier)) {
    throw new Error(
      `Invalid --verifier value "${value}". Expected a single non-empty verifier id.`,
    );
  }

  return verifier;
}

/** Parse acl --description without writing a blank commitment description. */
export function parseAclDescription(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid --description value. Expected a non-empty commitment description.',
    );
  }

  const description = value.trim();
  if (description.length === 0) {
    throw new Error(
      `Invalid --description value "${value}". Expected a non-empty commitment description.`,
    );
  }

  return description;
}

const ACL_SUBCOMMANDS = ['propose', 'verify', 'gate', 'list'] as const;
export type AclSubcommand = (typeof ACL_SUBCOMMANDS)[number];
const ACL_SUBCOMMAND_LIST = ACL_SUBCOMMANDS.join(', ');

/** Parse acl subcommand without treating blank or comma-separated values as an action. */
export function parseAclSubcommand(value: string | undefined): AclSubcommand {
  if (value === undefined) {
    throw new Error(
      `Invalid subcommand. Expected a single non-empty acl subcommand (${ACL_SUBCOMMAND_LIST}).`,
    );
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.includes(',') || /\s/.test(trimmed)) {
    throw new Error(
      `Invalid subcommand "${value}". Expected a single non-empty acl subcommand (${ACL_SUBCOMMAND_LIST}).`,
    );
  }

  const subcommand = trimmed.toLowerCase();
  if ((ACL_SUBCOMMANDS as readonly string[]).includes(subcommand)) {
    return subcommand as AclSubcommand;
  }

  throw new Error(
    `Invalid subcommand "${value}". Expected a single non-empty acl subcommand (${ACL_SUBCOMMAND_LIST}).`,
  );
}

const ACL_STATES = ['proposed', 'verified', 'active', 'fulfilled', 'rejected', 'expired'] as const;
const ACL_STATE_LIST = ACL_STATES.join(', ');

/** Parse acl list --state so filters are explicit and machine-readable. */
export function parseAclState(value: string | undefined): CommitmentState | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim().toLowerCase();
  if ((ACL_STATES as readonly string[]).includes(normalized)) {
    return normalized as CommitmentState;
  }

  throw new Error(
    `Invalid --state value "${value}". Expected one of: ${ACL_STATE_LIST}.`,
  );
}

/** Keep only commitments in the requested lifecycle state. */
export function filterAclCommitments(
  commitments: Commitment[],
  state: CommitmentState | undefined,
  type?: CommitmentType,
  criticality?: Criticality,
  proposer?: string,
): Commitment[] {
  return commitments.filter((commitment) =>
    (state === undefined || commitment.state === state)
    && (type === undefined || commitment.type === type)
    && (criticality === undefined || commitment.criticality === criticality)
    && (proposer === undefined || commitment.proposer === proposer),
  );
}

interface AclCommandOptions {
  type?: string;
  criticality?: string;
  description?: string;
  proposer?: string;
  expiresIn?: string;
  id?: string;
  verifier?: string;
  approve?: boolean;
  action?: string;
  limit?: string;
  offset?: string;
  state?: string;
  json?: boolean;
  jsonSummary?: boolean;
}

const MAX_ACL_LIMIT = 1000;
const MAX_ACL_OFFSET = 1000;

/** Parse acl list --limit without turning user input errors into an empty commitment list. */
export function parseAclLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ACL_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_ACL_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N commitments when --limit is set. */
export function applyAclLimit<T>(commitments: T[], limit: number | undefined): T[] {
  if (limit === undefined) return commitments;
  return commitments.slice(0, limit);
}

/** Parse acl list --offset without turning invalid input into an unbounded skip. */
export function parseAclOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_ACL_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_ACL_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N commitments before applying --limit. */
export function applyAclOffset<T>(commitments: T[], offset: number | undefined): T[] {
  if (offset === undefined) return commitments;
  return commitments.slice(offset);
}

const MAX_ACL_VERIFY_LIMIT = 1000;

/** Parse acl verify --limit without turning user input errors into an empty verify. */
export function parseAclVerifyLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ACL_VERIFY_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_ACL_VERIFY_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N verify status field rows when --limit is set. */
export function selectAclVerifyEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

const MAX_ACL_GATE_LIMIT = 1000;

/** Parse acl gate --limit without turning user input errors into an empty gate. */
export function parseAclGateLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ACL_GATE_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_ACL_GATE_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N gate status field rows when --limit is set. */
export function selectAclGateEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

const MAX_ACL_PROPOSE_LIMIT = 1000;

/** Parse acl propose --limit without turning user input errors into an empty propose. */
export function parseAclProposeLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ACL_PROPOSE_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_ACL_PROPOSE_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N propose status field rows when --limit is set. */
export function selectAclProposeEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

async function aclPropose(options: AclCommandOptions) {
  try {
    const limit = parseAclProposeLimit(options.limit);
    let expiresAt: string | undefined;
    const minutes = parseAclExpiresIn(options.expiresIn);
    if (minutes !== undefined) {
      expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    }

    const commitment = proposeCommitment({
      type: parseAclType(options.type),
      criticality: parseAclCriticality(options.criticality),
      description: parseAclDescription(options.description),
      proposer: parseAclProposer(options.proposer),
      expiresAt,
    });

    if (options.json) {
      console.log(formatAclCommitmentJson(commitment));
      return;
    }

    const rows = [
      `Commitment proposed: ${commitment.id}`,
      `State: ${commitment.state}`,
      `Criticality: ${commitment.criticality}`,
      `Expires: ${commitment.expiresAt || 'Never'}`,
    ];
    for (const row of selectAclProposeEntries(rows, limit)) {
      console.log(row);
    }
  } catch (error: any) {
    console.error('Error proposing commitment:', error.message);
    process.exit(1);
  }
}

async function aclVerify(options: AclCommandOptions) {
  try {
    const limit = parseAclVerifyLimit(options.limit);
    const id = parseAclId(options.id);
    const verifier = parseAclVerifier(options.verifier);
    const commitment = verifyCommitment(id, verifier, options.approve === true);
    if (!commitment) {
      if (options.json) {
        console.log(formatAclVerifyMissingJson(id));
        return;
      }
      console.error('Commitment not found:', id);
      process.exit(1);
    }
    if (options.json) {
      console.log(formatAclCommitmentJson(commitment));
      return;
    }
    const rows = [
      `Commitment ${id} is now: ${commitment.state}`,
      `Verified by: ${commitment.verifier}`,
    ];
    for (const row of selectAclVerifyEntries(rows, limit)) {
      console.log(row);
    }
  } catch (error: any) {
    console.error('Error verifying commitment:', error.message);
    process.exit(1);
  }
}

async function aclGate(options: AclCommandOptions) {
  try {
    const limit = parseAclGateLimit(options.limit);
    const action = parseAclAction(options.action);
    const result = gateAction(action);
    if (options.json) {
      console.log(
        formatAclGateJson({
          allowed: result.allowed,
          action,
          reason: result.reason ?? null,
        }),
      );
      process.exit(result.allowed ? 0 : 1);
    }
    const rows = result.allowed
      ? [`✅ Action '${action}' is ALLOWED`]
      : [`❌ Action '${action}' is BLOCKED`, `Reason: ${result.reason}`];
    for (const row of selectAclGateEntries(rows, limit)) {
      console.log(row);
    }
    process.exit(result.allowed ? 0 : 1);
  } catch (error: any) {
    console.error('Error gating action:', error.message);
    process.exit(1);
  }
}

async function aclList(options: AclCommandOptions = {}) {
  try {
    const offset = parseAclOffset(options.offset);
    const limit = parseAclLimit(options.limit);
    const state = parseAclState(options.state);
    const type = options.type === undefined ? undefined : parseAclType(options.type);
    const criticality = options.criticality === undefined
      ? undefined
      : parseAclCriticality(options.criticality);
    const proposer = options.proposer === undefined
      ? undefined
      : parseAclProposer(options.proposer);
    const allCommitments = filterAclCommitments(listCommitments(), state, type, criticality, proposer);
    const commitments = applyAclLimit(applyAclOffset(allCommitments, offset), limit);
    if (options.jsonSummary) {
      console.log(formatAclListJsonSummary(allCommitments, offset ?? 0, limit, state, type, criticality, proposer));
      return;
    }
    if (options.json) {
      console.log(formatAclListJson(commitments));
      return;
    }
    if (commitments.length === 0) {
      console.log(formatAclListEmpty(
        offset,
        limit,
        suggestAclListOffset(allCommitments.length, commitments.length, limit),
        state,
        type,
        criticality,
        proposer,
      ));
      return;
    }
    console.log(`${formatAclListHeading(commitments.length, offset, limit, state, type, criticality, proposer)}\n`);
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

export async function aclCommand(rawSubcommand: string, options: AclCommandOptions): Promise<void> {
  const subcommand = parseAclSubcommand(rawSubcommand);
  switch (subcommand) {
    case 'propose':
      return aclPropose(options);
    case 'verify':
      return aclVerify(options);
    case 'gate':
      return aclGate(options);
    case 'list':
      return aclList(options);
  }
}

export function registerACLCommands(program: Command) {
  program
    .command('acl <subcommand>')
    .description('Manage active commitments (ACL; single non-empty subcommand: propose, verify, gate, or list)')
    .option('-t, --type <type>', 'Commitment type (customer_promise, ticket_status_change, escalation_closure, account_tool_write)')
    .option('-c, --criticality <level>', 'Criticality level (c1, c2, c3)')
    .option('-d, --description <text>', 'Description of the commitment (non-empty)')
    .option('-p, --proposer <id>', 'ID of the proposing agent for propose, or a proposer filter for list (single non-empty id)')
    .option('-e, --expires-in <minutes>', 'Minutes until expiration')
    .option('-i, --id <id>', 'Commitment ID (single non-empty id)')
    .option('-v, --verifier <id>', 'ID of the verifier (single non-empty id)')
    .option('--approve', 'Approve the commitment (default is reject)')
    .option('-a, --action <type>', 'Action type to check (customer_promise, ticket_status_change, escalation_closure, account_tool_write)')
    .option('--limit <n>', 'Maximum number of commitments to show on list, or status field rows on verify, gate, or propose')
    .option('--offset <n>', 'Skip the first N commitments on list before applying --limit (non-negative integer up to 1000)')
    .option('--state <state>', 'Only show commitments in a lifecycle state (proposed, verified, active, fulfilled, rejected, expired)')
    .option('--json', 'Output as JSON')
    .option('--json-summary', 'Output list pagination metadata and entries as JSON')
    .action(aclCommand);
}
