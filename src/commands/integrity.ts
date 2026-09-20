/**
 * savestate integrity — Memory Integrity Grid commands
 *
 * Detect and contain memory poisoning through honeyfact
 * seeding, tripwire monitoring, and containment controls.
 *
 * @see https://github.com/savestatedev/savestate/issues/112
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { isInitialized, loadConfig, saveConfig } from '../config.js';
import {
  seedHoneyfacts,
  getHoneyfactStats,
  rotateHoneyfacts,
  clearHoneyfacts,
  TripwireMonitor,
  getIncidents,
  getIncident,
  updateIncidentStatus,
  getIncidentStats,
  ContainmentController,
  getQuarantinedMemories,
  getQuarantinedAgents,
  getPendingApprovals,
} from '../integrity/index.js';
import type {
  IntegrityIncident,
  ContainmentPolicy,
} from '../integrity/index.js';

interface IntegrityOptions {
  json?: boolean;
  tenant?: string;
  count?: string;
  status?: string;
  policy?: string;
  force?: boolean;
  reason?: string;
  user?: string;
}

const MAX_INTEGRITY_COUNT = 1000;
const MAX_INTEGRITY_TTL_DAYS = 365;

/** Parse a honeyfact seed count without turning user input errors into an empty or NaN seed. */
export function parseIntegrityCount(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_INTEGRITY_COUNT) {
    throw new Error(
      `Invalid --count value "${value}". Expected a positive integer up to ${MAX_INTEGRITY_COUNT}.`,
    );
  }
  return count;
}

/** Parse integrity --tenant without treating blank or comma-separated ids as a tenant. */
export function parseIntegrityTenant(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const tenant = value.trim();
  if (tenant.length === 0 || tenant.includes(',') || /\s/.test(tenant)) {
    throw new Error(
      `Invalid --tenant value "${value}". Expected a single non-empty tenant id.`,
    );
  }

  return tenant;
}

/** Parse honeyfact.ttl_days without writing NaN or unbounded TTLs into integrity config. */
export function parseIntegrityTtlDays(value: string): number {
  const ttlDays = Number(value);
  if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > MAX_INTEGRITY_TTL_DAYS) {
    throw new Error(
      `Invalid honeyfact.ttl_days value "${value}". Expected a positive integer up to ${MAX_INTEGRITY_TTL_DAYS}.`,
    );
  }
  return ttlDays;
}

/** Parse honeyfact.count without writing NaN or unbounded seed counts into integrity config. */
export function parseIntegrityHoneyfactCount(value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_INTEGRITY_COUNT) {
    throw new Error(
      `Invalid honeyfact.count value "${value}". Expected a positive integer up to ${MAX_INTEGRITY_COUNT}.`,
    );
  }
  return count;
}

/** Parse tripwire.threshold without writing NaN or out-of-range scores into integrity config. */
export function parseIntegrityTripwireThreshold(value: string): number {
  const threshold = Number(value);
  if (value.trim() === '' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error(
      `Invalid tripwire.threshold value "${value}". Expected a number between 0 and 1.`,
    );
  }
  return threshold;
}

const CONTAINMENT_POLICIES: ContainmentPolicy[] = ['observe', 'approve', 'auto'];
const CONTAINMENT_POLICY_LIST = CONTAINMENT_POLICIES.join(', ');
const INCIDENT_STATUSES: IntegrityIncident['status'][] = [
  'open',
  'investigating',
  'contained',
  'resolved',
  'false_positive',
];
const INCIDENT_STATUS_LIST = INCIDENT_STATUSES.join(', ');

/** Parse containment.policy without writing unknown values or exiting the process. */
export function parseIntegrityContainmentPolicy(value: string): ContainmentPolicy {
  if (CONTAINMENT_POLICIES.includes(value as ContainmentPolicy)) {
    return value as ContainmentPolicy;
  }

  throw new Error(
    `Invalid containment.policy value "${value}". Expected one of: ${CONTAINMENT_POLICY_LIST}.`,
  );
}

/** Parse integrity incidents --status without silently treating unknown values as an empty filter. */
export function parseIntegrityIncidentStatus(
  value: string | undefined,
): IntegrityIncident['status'] | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim().toLowerCase();
  if ((INCIDENT_STATUSES as string[]).includes(normalized)) {
    return normalized as IntegrityIncident['status'];
  }

  throw new Error(
    `Invalid --status value "${value}". Expected one of: ${INCIDENT_STATUS_LIST}.`,
  );
}

/** Parse integrity --policy without silently ignoring unknown containment policies. */
export function parseIntegrityPolicy(
  value: string | undefined,
): ContainmentPolicy | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim().toLowerCase();
  if ((CONTAINMENT_POLICIES as string[]).includes(normalized)) {
    return normalized as ContainmentPolicy;
  }

  throw new Error(
    `Invalid --policy value "${value}". Expected one of: ${CONTAINMENT_POLICY_LIST}.`,
  );
}

/** Parse enabled without silently writing false for unknown boolean values. */
export function parseIntegrityEnabled(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(
    `Invalid enabled value "${value}". Expected true or false.`,
  );
}

/** Parse tripwire.fuzzy_enabled without silently writing false for unknown boolean values. */
export function parseIntegrityFuzzyEnabled(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(
    `Invalid tripwire.fuzzy_enabled value "${value}". Expected true or false.`,
  );
}

/** Parse containment.auto_escalate without silently writing false for unknown boolean values. */
export function parseIntegrityAutoEscalate(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(
    `Invalid containment.auto_escalate value "${value}". Expected true or false.`,
  );
}

/** Parse integrity --user without treating blank or comma-separated values as an actor. */
export function parseIntegrityUser(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const user = value.trim();
  if (user.length === 0 || user.includes(',') || /\s/.test(user)) {
    throw new Error(
      `Invalid --user value "${value}". Expected a single non-empty user id.`,
    );
  }

  return user;
}

/** Parse integrity --reason without writing a blank quarantine/release reason. */
export function parseIntegrityReason(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const reason = value.trim();
  if (reason.length === 0) {
    throw new Error(
      `Invalid --reason value "${value}". Expected a non-empty reason.`,
    );
  }

  return reason;
}

const INTEGRITY_SUBCOMMANDS = [
  'status',
  'seed',
  'rotate',
  'incidents',
  'incident',
  'quarantine',
  'release',
  'config',
  'test',
  'clear',
] as const;
export type IntegritySubcommand = (typeof INTEGRITY_SUBCOMMANDS)[number];
const INTEGRITY_SUBCOMMAND_LIST = INTEGRITY_SUBCOMMANDS.join(', ');

/** Parse integrity subcommand without treating blank or comma-separated values as an action. */
export function parseIntegritySubcommand(value: string | undefined): IntegritySubcommand {
  if (value === undefined) {
    throw new Error(
      `Invalid subcommand. Expected a single non-empty integrity subcommand (${INTEGRITY_SUBCOMMAND_LIST}).`,
    );
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.includes(',') || /\s/.test(trimmed)) {
    throw new Error(
      `Invalid subcommand "${value}". Expected a single non-empty integrity subcommand (${INTEGRITY_SUBCOMMAND_LIST}).`,
    );
  }

  const subcommand = trimmed.toLowerCase();
  if ((INTEGRITY_SUBCOMMANDS as readonly string[]).includes(subcommand)) {
    return subcommand as IntegritySubcommand;
  }

  throw new Error(
    `Invalid subcommand "${value}". Expected a single non-empty integrity subcommand (${INTEGRITY_SUBCOMMAND_LIST}).`,
  );
}

/** Parse integrity incident id without looking up blank or comma-separated ids. */
export function parseIntegrityIncidentId(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid incident id. Expected a single non-empty incident id.',
    );
  }

  const id = value.trim();
  if (id.length === 0 || id.includes(',') || /\s/.test(id)) {
    throw new Error(
      `Invalid incident id "${value}". Expected a single non-empty incident id.`,
    );
  }

  return id;
}

/** Parse integrity quarantine/release id without treating blank or comma-separated values as a target. */
export function parseIntegrityTargetId(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid memory or agent id. Expected a single non-empty memory or agent id.',
    );
  }

  const id = value.trim();
  if (id.length === 0 || id.includes(',') || /\s/.test(id)) {
    throw new Error(
      `Invalid memory or agent id "${value}". Expected a single non-empty memory or agent id.`,
    );
  }

  return id;
}

/** Parse integrity test input without running the tripwire on blank text. */
export function parseIntegrityTestInput(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid test input. Expected a non-empty text to check.',
    );
  }

  const input = value.trim();
  if (input.length === 0) {
    throw new Error(
      `Invalid test input "${value}". Expected a non-empty text to check.`,
    );
  }

  return input;
}

export interface IntegrityIncidentJson {
  id: string;
  createdAt: string;
  severity: string;
  type: string;
  status: string;
  tenantId: string;
  updatedAt: string;
  eventCount: number;
  resolutionNotes: string | null;
  resolvedBy: string | null;
}

function toIncidentJson(incident: IntegrityIncident): IntegrityIncidentJson {
  return {
    id: incident.id,
    createdAt: incident.created_at,
    severity: incident.severity,
    type: incident.type,
    status: incident.status,
    tenantId: incident.tenant_id,
    updatedAt: incident.updated_at,
    eventCount: incident.events.length,
    resolutionNotes: incident.resolution_notes ?? null,
    resolvedBy: incident.resolved_by ?? null,
  };
}

export function formatIntegrityIncidentJson(incident: IntegrityIncident): string {
  return JSON.stringify(toIncidentJson(incident), null, 2);
}

export interface IntegrityIncidentMissingJson {
  found: false;
  id: string;
  status: null;
  eventCount: 0;
}

export function formatIntegrityIncidentMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      status: null,
      eventCount: 0,
    },
    null,
    2,
  );
}

export function formatIntegrityIncidentsJson(incidents: IntegrityIncident[]): string {
  return JSON.stringify(incidents.map(toIncidentJson), null, 2);
}

export interface IntegrityIncidentsMissingJson {
  found: false;
  total: 0;
  shown: 0;
}

export function formatIntegrityIncidentsMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      total: 0,
      shown: 0,
    },
    null,
    2,
  );
}

export interface IntegrityStatusHoneyfactsJson {
  active: number;
  expired: number;
  total: number;
}

export interface IntegrityStatusIncidentsJson {
  open: number;
  contained: number;
  resolved: number;
  events: number;
}

export interface IntegrityStatusContainmentJson {
  quarantinedMemories: number;
  quarantinedAgents: number;
  pendingApprovals: number;
  lastActionAt: string | null;
}

export interface IntegrityStatusJson {
  enabled: boolean;
  policy: string;
  honeyfacts: IntegrityStatusHoneyfactsJson;
  incidents: IntegrityStatusIncidentsJson;
  containment: IntegrityStatusContainmentJson;
}

export function formatIntegrityStatusJson(result: IntegrityStatusJson): string {
  return JSON.stringify(
    {
      enabled: result.enabled,
      policy: result.policy,
      honeyfacts: {
        active: result.honeyfacts.active,
        expired: result.honeyfacts.expired,
        total: result.honeyfacts.total,
      },
      incidents: {
        open: result.incidents.open,
        contained: result.incidents.contained,
        resolved: result.incidents.resolved,
        events: result.incidents.events,
      },
      containment: {
        quarantinedMemories: result.containment.quarantinedMemories,
        quarantinedAgents: result.containment.quarantinedAgents,
        pendingApprovals: result.containment.pendingApprovals,
        lastActionAt: result.containment.lastActionAt,
      },
    },
    null,
    2,
  );
}

export interface IntegrityStatusMissingJson {
  found: false;
  enabled: false;
  policy: null;
  honeyfacts: 0;
  incidents: 0;
}

export function formatIntegrityStatusMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      enabled: false,
      policy: null,
      honeyfacts: 0,
      incidents: 0,
    },
    null,
    2,
  );
}

export interface IntegrityRotateJson {
  rotated: number;
  valid: number;
  createdCount: number;
  retiredCount: number;
  tenantId: string;
  ttlDays: number;
  rotatedAt: string;
}

export function formatIntegrityRotateJson(result: IntegrityRotateJson): string {
  return JSON.stringify(
    {
      rotated: result.rotated,
      valid: result.valid,
      createdCount: result.createdCount,
      retiredCount: result.retiredCount,
      tenantId: result.tenantId,
      ttlDays: result.ttlDays,
      rotatedAt: result.rotatedAt,
    },
    null,
    2,
  );
}

export interface IntegrityRotateMissingJson {
  found: false;
  rotated: 0;
  valid: 0;
  createdCount: 0;
  retiredCount: 0;
}

export function formatIntegrityRotateMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      rotated: 0,
      valid: 0,
      createdCount: 0,
      retiredCount: 0,
    },
    null,
    2,
  );
}

export interface IntegritySeedJson {
  count: number;
  tenantId: string;
  ttlDays: number;
  seededAt: string;
}

export function formatIntegritySeedJson(result: IntegritySeedJson): string {
  return JSON.stringify(
    {
      count: result.count,
      tenantId: result.tenantId,
      ttlDays: result.ttlDays,
      seededAt: result.seededAt,
    },
    null,
    2,
  );
}

export interface IntegritySeedMissingJson {
  found: false;
  count: 0;
}

export function formatIntegritySeedMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      count: 0,
    },
    null,
    2,
  );
}

export interface IntegrityQuarantineJson {
  success: boolean;
  requiresApproval: boolean;
  targetId: string;
  targetType: string;
  action: string;
  reason: string;
  eventId: string;
  error: string | null;
}

export function formatIntegrityQuarantineJson(result: IntegrityQuarantineJson): string {
  return JSON.stringify(
    {
      success: result.success,
      requiresApproval: result.requiresApproval,
      targetId: result.targetId,
      targetType: result.targetType,
      action: result.action,
      reason: result.reason,
      eventId: result.eventId,
      error: result.error,
    },
    null,
    2,
  );
}

export interface IntegrityQuarantineMissingJson {
  found: false;
  success: false;
  eventId: null;
}

export function formatIntegrityQuarantineMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      success: false,
      eventId: null,
    },
    null,
    2,
  );
}

export interface IntegrityReleaseJson {
  success: boolean;
  requiresApproval: boolean;
  targetId: string;
  targetType: string;
  action: string;
  reason: string;
  eventId: string;
  error: string | null;
}

export function formatIntegrityReleaseJson(result: IntegrityReleaseJson): string {
  return JSON.stringify(
    {
      success: result.success,
      requiresApproval: result.requiresApproval,
      targetId: result.targetId,
      targetType: result.targetType,
      action: result.action,
      reason: result.reason,
      eventId: result.eventId,
      error: result.error,
    },
    null,
    2,
  );
}

export interface IntegrityReleaseMissingJson {
  found: false;
  targetId: string;
  success: false;
  eventId: null;
}

export function formatIntegrityReleaseMissingJson(targetId: string): string {
  return JSON.stringify(
    {
      found: false,
      targetId,
      success: false,
      eventId: null,
    },
    null,
    2,
  );
}

export interface IntegrityClearJson {
  cleared: number;
  tenantId: string;
}

export function formatIntegrityClearJson(result: IntegrityClearJson): string {
  return JSON.stringify(
    {
      cleared: result.cleared,
      tenantId: result.tenantId,
    },
    null,
    2,
  );
}

export interface IntegrityClearMissingJson {
  found: false;
  cleared: 0;
}

export function formatIntegrityClearMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      cleared: 0,
    },
    null,
    2,
  );
}

export interface IntegrityConfigJson {
  enabled: boolean;
  honeyfactCount: number;
  honeyfactTtlDays: number;
  tripwireThreshold: number;
  tripwireFuzzyEnabled: boolean;
  containmentPolicy: string;
  containmentAutoEscalate: boolean;
}

export function formatIntegrityConfigJson(result: IntegrityConfigJson): string {
  return JSON.stringify(
    {
      enabled: result.enabled,
      honeyfactCount: result.honeyfactCount,
      honeyfactTtlDays: result.honeyfactTtlDays,
      tripwireThreshold: result.tripwireThreshold,
      tripwireFuzzyEnabled: result.tripwireFuzzyEnabled,
      containmentPolicy: result.containmentPolicy,
      containmentAutoEscalate: result.containmentAutoEscalate,
    },
    null,
    2,
  );
}

export interface IntegrityConfigMissingJson {
  found: false;
  enabled: false;
}

export function formatIntegrityConfigMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      enabled: false,
    },
    null,
    2,
  );
}

export interface IntegrityTestEventJson {
  id: string;
  honeyfactId: string;
  confidence: number;
  detectedIn: string;
}

export interface IntegrityTestJson {
  triggered: boolean;
  durationMs: number;
  eventCount: number;
  events: IntegrityTestEventJson[];
  incidentId: string | null;
  incidentSeverity: string | null;
}

export function formatIntegrityTestJson(result: IntegrityTestJson): string {
  return JSON.stringify(
    {
      triggered: result.triggered,
      durationMs: result.durationMs,
      eventCount: result.eventCount,
      events: result.events.map((event) => ({
        id: event.id,
        honeyfactId: event.honeyfactId,
        confidence: event.confidence,
        detectedIn: event.detectedIn,
      })),
      incidentId: result.incidentId,
      incidentSeverity: result.incidentSeverity,
    },
    null,
    2,
  );
}

export interface IntegrityTestMissingJson {
  found: false;
  triggered: false;
  eventCount: 0;
  incidentId: null;
}

export function formatIntegrityTestMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      triggered: false,
      eventCount: 0,
      incidentId: null,
    },
    null,
    2,
  );
}

export async function integrityCommand(
  rawSubcommand: string | undefined,
  args: string[],
  options: IntegrityOptions,
): Promise<void> {
  const subcommand = parseIntegritySubcommand(rawSubcommand);
  const incidentId = subcommand === 'incident' ? parseIntegrityIncidentId(args[0]) : undefined;
  const targetId =
    subcommand === 'quarantine' || subcommand === 'release'
      ? parseIntegrityTargetId(args[0])
      : undefined;
  const testInput = subcommand === 'test' ? parseIntegrityTestInput(args[0]) : undefined;
  const policy = parseIntegrityPolicy(options.policy);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json && subcommand === 'rotate') {
      console.log(formatIntegrityRotateMissingJson());
      return;
    }
    if (options.json && subcommand === 'seed') {
      console.log(formatIntegritySeedMissingJson());
      return;
    }
    if (options.json && subcommand === 'quarantine') {
      console.log(formatIntegrityQuarantineMissingJson());
      return;
    }
    if (options.json && subcommand === 'release') {
      console.log(formatIntegrityReleaseMissingJson(targetId ?? ''));
      return;
    }
    if (options.json && subcommand === 'clear') {
      console.log(formatIntegrityClearMissingJson());
      return;
    }
    if (options.json && subcommand === 'incidents') {
      console.log(formatIntegrityIncidentsMissingJson());
      return;
    }
    if (options.json && subcommand === 'incident') {
      console.log(formatIntegrityIncidentMissingJson(incidentId ?? ''));
      return;
    }
    if (options.json && subcommand === 'config') {
      console.log(formatIntegrityConfigMissingJson());
      return;
    }
    if (options.json && subcommand === 'test') {
      console.log(formatIntegrityTestMissingJson());
      return;
    }
    if (options.json && subcommand === 'status') {
      console.log(formatIntegrityStatusMissingJson());
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  if (policy) {
    const controller = new ContainmentController();
    await controller.updateConfig({ policy });
  }

  switch (subcommand) {
    case 'status':
      await showStatus(options);
      return;
    case 'seed':
      await seedCommand(options);
      return;
    case 'rotate':
      await rotateCommand(options);
      return;
    case 'incidents':
      await incidentsCommand(options);
      return;
    case 'incident':
      await incidentDetailCommand(incidentId!, options);
      return;
    case 'quarantine':
      await quarantineCommand(targetId!, options);
      return;
    case 'release':
      await releaseCommand(targetId!, options);
      return;
    case 'config':
      await configCommand(args[0], options);
      return;
    case 'test':
      await testMonitorCommand(testInput!, options);
      return;
    case 'clear':
      await clearCommand(options);
      return;
  }
}

/**
 * Show integrity monitoring status.
 */
async function showStatus(options: IntegrityOptions): Promise<void> {
  const config = await loadConfig();
  const tenant_id = parseIntegrityTenant(options.tenant) ?? 'default';

  const honeyfactStats = await getHoneyfactStats(tenant_id);
  const incidentStats = await getIncidentStats(tenant_id);
  const controller = new ContainmentController();
  const containmentStatus = await controller.getStatus();

  if (options.json) {
    console.log(
      formatIntegrityStatusJson({
        enabled: config.integrity?.enabled ?? false,
        policy: containmentStatus.policy,
        honeyfacts: {
          active: honeyfactStats.active,
          expired: honeyfactStats.expired,
          total: honeyfactStats.total,
        },
        incidents: {
          open: incidentStats.by_status.open,
          contained: incidentStats.by_status.contained,
          resolved: incidentStats.by_status.resolved,
          events: incidentStats.events_total,
        },
        containment: {
          quarantinedMemories: containmentStatus.quarantined_memories,
          quarantinedAgents: containmentStatus.quarantined_agents,
          pendingApprovals: containmentStatus.pending_approvals,
          lastActionAt: containmentStatus.last_action_at ?? null,
        },
      }),
    );
    return;
  }

  const enabled = config.integrity?.enabled ?? false;
  const statusIcon = enabled ? chalk.green('●') : chalk.dim('○');
  const statusText = enabled ? chalk.green('enabled') : chalk.dim('disabled');

  console.log(chalk.bold('🛡️  Memory Integrity Grid'));
  console.log(chalk.dim('   Detect and contain memory poisoning'));
  console.log();
  console.log(`  Status:      ${statusIcon} ${statusText}`);
  console.log(`  Policy:      ${chalk.cyan(containmentStatus.policy)}`);
  console.log();

  // Honeyfact stats
  console.log(chalk.bold('  Honeyfacts'));
  console.log(`    Active:    ${chalk.green(honeyfactStats.active)}`);
  console.log(`    Expired:   ${chalk.dim(honeyfactStats.expired)}`);
  console.log(`    Total:     ${honeyfactStats.total}`);
  console.log();

  // Incident stats
  console.log(chalk.bold('  Incidents'));
  console.log(`    Open:      ${incidentStats.by_status.open > 0 ? chalk.red(incidentStats.by_status.open) : chalk.green('0')}`);
  console.log(`    Contained: ${chalk.yellow(incidentStats.by_status.contained)}`);
  console.log(`    Resolved:  ${chalk.green(incidentStats.by_status.resolved)}`);
  console.log(`    Events:    ${incidentStats.events_total}`);
  console.log();

  // Containment stats
  console.log(chalk.bold('  Containment'));
  console.log(`    Quarantined Memories: ${containmentStatus.quarantined_memories > 0 ? chalk.red(containmentStatus.quarantined_memories) : chalk.green('0')}`);
  console.log(`    Quarantined Agents:   ${containmentStatus.quarantined_agents > 0 ? chalk.red(containmentStatus.quarantined_agents) : chalk.green('0')}`);
  console.log(`    Pending Approvals:    ${containmentStatus.pending_approvals > 0 ? chalk.yellow(containmentStatus.pending_approvals) : '0'}`);

  if (containmentStatus.last_action_at) {
    console.log(`    Last Action:          ${chalk.dim(containmentStatus.last_action_at)}`);
  }
  console.log();
}

/**
 * Seed honeyfacts.
 */
async function seedCommand(options: IntegrityOptions): Promise<void> {
  const config = await loadConfig();
  const tenant_id = parseIntegrityTenant(options.tenant) ?? 'default';
  const count = parseIntegrityCount(options.count) ?? (config.integrity?.honeyfact.count ?? 10);
  const ttl_days = config.integrity?.honeyfact.ttl_days ?? 7;

  if (!options.json) {
    console.log(chalk.dim(`  Seeding ${count} honeyfacts for tenant: ${tenant_id}`));
  }

  const result = await seedHoneyfacts('integrity', count, {
    tenant_id,
    ttl_days,
  });

  if (options.json) {
    console.log(
      formatIntegritySeedJson({
        count: result.count,
        tenantId: result.tenant_id,
        ttlDays: ttl_days,
        seededAt: result.seeded_at,
      }),
    );
    return;
  }

  console.log(chalk.green(`✓ Seeded ${result.count} honeyfacts`));
  console.log();

  // Show category breakdown
  const byCategory: Record<string, number> = {};
  for (const hf of result.honeyfacts) {
    byCategory[hf.category] = (byCategory[hf.category] ?? 0) + 1;
  }

  console.log(chalk.dim('  Categories:'));
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`    ${category}: ${count}`);
  }
  console.log();
  console.log(chalk.dim(`  TTL: ${ttl_days} days`));
  console.log(chalk.dim(`  Seeded at: ${result.seeded_at}`));
  console.log();
}

/**
 * Rotate expired honeyfacts.
 */
async function rotateCommand(options: IntegrityOptions): Promise<void> {
  const config = await loadConfig();
  const tenant_id = parseIntegrityTenant(options.tenant) ?? 'default';
  const ttl_days = config.integrity?.honeyfact.ttl_days ?? 7;

  const result = await rotateHoneyfacts({
    tenant_id,
    ttl_days,
  });

  if (options.json) {
    console.log(
      formatIntegrityRotateJson({
        rotated: result.rotated,
        valid: result.valid,
        createdCount: result.created.length,
        retiredCount: result.retired.length,
        tenantId: tenant_id,
        ttlDays: ttl_days,
        rotatedAt: result.rotated_at,
      }),
    );
    return;
  }

  if (result.rotated === 0) {
    console.log(chalk.dim('  No honeyfacts needed rotation.'));
    console.log(chalk.dim(`  Active: ${result.valid}`));
  } else {
    console.log(chalk.green(`✓ Rotated ${result.rotated} honeyfacts`));
    console.log(chalk.dim(`  Created: ${result.created.length}`));
    console.log(chalk.dim(`  Active: ${result.valid}`));
  }
  console.log();
}

/**
 * List incidents.
 */
async function incidentsCommand(options: IntegrityOptions): Promise<void> {
  const tenant_id = parseIntegrityTenant(options.tenant);
  const status = parseIntegrityIncidentStatus(options.status);

  const incidents = await getIncidents(tenant_id, status);

  if (options.json) {
    console.log(formatIntegrityIncidentsJson(incidents));
    return;
  }

  console.log(chalk.bold('🚨 Integrity Incidents'));
  console.log();

  if (incidents.length === 0) {
    console.log(chalk.dim('  No incidents found.'));
    console.log();
    return;
  }

  for (const incident of incidents.slice(0, 20)) {
    const severityColor = {
      low: chalk.dim,
      medium: chalk.yellow,
      high: chalk.red,
      critical: chalk.bgRed.white,
    }[incident.severity];

    const statusColor = {
      open: chalk.red,
      investigating: chalk.yellow,
      contained: chalk.blue,
      resolved: chalk.green,
      false_positive: chalk.dim,
    }[incident.status];

    console.log(
      `  ${chalk.cyan(incident.id)}  ${severityColor(incident.severity.padEnd(8))} ${statusColor(incident.status.padEnd(12))} ${incident.type}`
    );
    console.log(
      `    ${chalk.dim('created:')} ${incident.created_at}  ${chalk.dim('events:')} ${incident.events.length}`
    );
  }

  if (incidents.length > 20) {
    console.log(chalk.dim(`  ... and ${incidents.length - 20} more`));
  }
  console.log();
}

/**
 * Show incident details.
 */
async function incidentDetailCommand(id: string, options: IntegrityOptions): Promise<void> {
  const incident = await getIncident(id);

  if (!incident) {
    if (options.json) {
      console.log(formatIntegrityIncidentMissingJson(id));
      return;
    }
    console.log(chalk.red(`✗ Incident not found: ${id}`));
    process.exit(1);
  }

  if (options.json) {
    console.log(formatIntegrityIncidentJson(incident));
    return;
  }

  const severityColor = {
    low: chalk.dim,
    medium: chalk.yellow,
    high: chalk.red,
    critical: chalk.bgRed.white,
  }[incident.severity];

  console.log(chalk.bold(`🚨 Incident: ${incident.id}`));
  console.log();
  console.log(`  Type:      ${incident.type}`);
  console.log(`  Severity:  ${severityColor(incident.severity)}`);
  console.log(`  Status:    ${incident.status}`);
  console.log(`  Created:   ${incident.created_at}`);
  console.log(`  Updated:   ${incident.updated_at}`);
  console.log(`  Tenant:    ${incident.tenant_id}`);
  console.log();

  if (incident.resolution_notes) {
    console.log(chalk.bold('  Resolution'));
    console.log(`    Notes:   ${incident.resolution_notes}`);
    if (incident.resolved_by) {
      console.log(`    By:      ${incident.resolved_by}`);
    }
    console.log();
  }

  console.log(chalk.bold(`  Events (${incident.events.length})`));
  for (const event of incident.events) {
    console.log(`    ${chalk.cyan(event.id)} ${event.detected_in.padEnd(12)} confidence=${event.confidence.toFixed(2)}`);
    console.log(`      honeyfact: ${event.honeyfact_id}`);
    console.log(`      matched: "${event.context.matched_content.slice(0, 50)}${event.context.matched_content.length > 50 ? '...' : ''}"`);
  }
  console.log();
}

/**
 * Quarantine a memory or agent.
 */
async function quarantineCommand(id: string, options: IntegrityOptions): Promise<void> {
  if (!id) {
    console.log(chalk.red('✗ ID required'));
    console.log(chalk.dim('  Usage: savestate integrity quarantine <memory_id|agent_id>'));
    process.exit(1);
  }

  const reason = parseIntegrityReason(options.reason) ?? 'Manual quarantine via CLI';
  const user = parseIntegrityUser(options.user) ?? 'cli';
  const controller = new ContainmentController();

  // Determine if it's a memory or agent based on prefix
  const isAgent = id.startsWith('agent_') || id.startsWith('session_');

  let result;
  if (isAgent) {
    result = await controller.quarantineAgent(id, reason, {
      initiated_by: user,
      tenant_id: parseIntegrityTenant(options.tenant) ?? 'default',
      force: options.force,
    });
  } else {
    result = await controller.quarantineMemory(id, reason, {
      initiated_by: user,
      tenant_id: parseIntegrityTenant(options.tenant) ?? 'default',
      force: options.force,
    });
  }

  if (options.json) {
    console.log(
      formatIntegrityQuarantineJson({
        success: result.success,
        requiresApproval: result.requires_approval,
        targetId: result.event.target_id,
        targetType: result.event.target_type,
        action: result.event.action,
        reason: result.event.reason,
        eventId: result.event.id,
        error: result.error ?? null,
      }),
    );
    return;
  }

  if (!result.success) {
    console.log(chalk.red(`✗ Quarantine failed: ${result.error}`));
    process.exit(1);
  }

  if (result.requires_approval) {
    console.log(chalk.yellow('⏳ Quarantine pending approval'));
    console.log(chalk.dim(`  ID: ${id}`));
    console.log(chalk.dim(`  Reason: ${reason}`));
    console.log(chalk.dim('  Use --force to bypass approval'));
  } else {
    console.log(chalk.green(`✓ ${isAgent ? 'Agent' : 'Memory'} quarantined: ${id}`));
    console.log(chalk.dim(`  Event: ${result.event.id}`));
    console.log(chalk.dim(`  Reason: ${reason}`));
  }
  console.log();
}

/**
 * Release from quarantine.
 */
async function releaseCommand(id: string, options: IntegrityOptions): Promise<void> {
  if (!id) {
    console.log(chalk.red('✗ ID required'));
    console.log(chalk.dim('  Usage: savestate integrity release <memory_id|agent_id>'));
    process.exit(1);
  }

  const reason = parseIntegrityReason(options.reason) ?? 'Released via CLI';
  const user = parseIntegrityUser(options.user) ?? 'cli';
  const controller = new ContainmentController();

  // Check quarantine lists to determine type
  const quarantinedMemories = await getQuarantinedMemories('active');
  const quarantinedAgents = await getQuarantinedAgents('active');

  const isMemory = quarantinedMemories.some(qm => qm.memory_id === id);
  const isAgent = quarantinedAgents.some(qa => qa.agent_id === id);

  if (!isMemory && !isAgent) {
    // Check if it's a pending approval
    const pending = await getPendingApprovals();
    const approval = pending.find(pa => pa.id === id);
    if (approval) {
      const result = await controller.dismissApproval(id, user, reason);
      if (options.json) {
        console.log(
          formatIntegrityReleaseJson({
            success: result.success,
            requiresApproval: result.requires_approval,
            targetId: result.event.target_id,
            targetType: result.event.target_type,
            action: result.event.action,
            reason: result.event.reason,
            eventId: result.event.id,
            error: result.error ?? null,
          }),
        );
        return;
      }
      console.log(chalk.green(`✓ Approval dismissed: ${id}`));
      console.log();
      return;
    }

    if (options.json) {
      console.log(formatIntegrityReleaseMissingJson(id));
      return;
    }
    console.log(chalk.red(`✗ Not found in quarantine: ${id}`));
    process.exit(1);
  }

  let result;
  if (isAgent) {
    result = await controller.releaseAgent(id, reason, user);
  } else {
    result = await controller.releaseMemory(id, reason, user);
  }

  if (options.json) {
    console.log(
      formatIntegrityReleaseJson({
        success: result.success,
        requiresApproval: result.requires_approval,
        targetId: result.event.target_id,
        targetType: result.event.target_type,
        action: result.event.action,
        reason: result.event.reason,
        eventId: result.event.id,
        error: result.error ?? null,
      }),
    );
    return;
  }

  if (!result.success) {
    console.log(chalk.red(`✗ Release failed: ${result.error}`));
    process.exit(1);
  }

  console.log(chalk.green(`✓ ${isAgent ? 'Agent' : 'Memory'} released: ${id}`));
  console.log(chalk.dim(`  Event: ${result.event.id}`));
  console.log();
}

/**
 * Configure integrity settings.
 */
async function configCommand(setting: string | undefined, options: IntegrityOptions): Promise<void> {
  const config = await loadConfig();

  if (!setting) {
    // Show current config
    if (options.json) {
      console.log(
        formatIntegrityConfigJson({
          enabled: config.integrity?.enabled ?? false,
          honeyfactCount: config.integrity?.honeyfact.count ?? 10,
          honeyfactTtlDays: config.integrity?.honeyfact.ttl_days ?? 7,
          tripwireThreshold: config.integrity?.tripwire.threshold ?? 0.8,
          tripwireFuzzyEnabled: config.integrity?.tripwire.fuzzy_enabled ?? true,
          containmentPolicy: config.integrity?.containment.policy ?? 'approve',
          containmentAutoEscalate: config.integrity?.containment.auto_escalate_critical ?? true,
        }),
      );
      return;
    }

    console.log(chalk.bold('🔧 Integrity Configuration'));
    console.log();
    console.log(`  enabled:                    ${config.integrity?.enabled ?? false}`);
    console.log(`  honeyfact.count:            ${config.integrity?.honeyfact.count ?? 10}`);
    console.log(`  honeyfact.ttl_days:         ${config.integrity?.honeyfact.ttl_days ?? 7}`);
    console.log(`  tripwire.threshold:         ${config.integrity?.tripwire.threshold ?? 0.8}`);
    console.log(`  tripwire.fuzzy_enabled:     ${config.integrity?.tripwire.fuzzy_enabled ?? true}`);
    console.log(`  containment.policy:         ${config.integrity?.containment.policy ?? 'approve'}`);
    console.log(`  containment.auto_escalate:  ${config.integrity?.containment.auto_escalate_critical ?? true}`);
    console.log();
    return;
  }

  // Parse setting=value
  const [key, value] = setting.split('=');
  if (!value) {
    console.log(chalk.red(`✗ Invalid format. Use: savestate integrity config <key>=<value>`));
    console.log(chalk.dim('  Example: savestate integrity config enabled=true'));
    process.exit(1);
  }

  // Ensure integrity config exists
  if (!config.integrity) {
    config.integrity = {
      enabled: false,
      honeyfact: { count: 10, ttl_days: 7 },
      tripwire: { threshold: 0.8, fuzzy_enabled: true },
      containment: { policy: 'approve', auto_escalate_critical: true },
    };
  }

  // Apply setting
  switch (key) {
    case 'enabled':
      config.integrity.enabled = parseIntegrityEnabled(value);
      break;
    case 'honeyfact.count':
      config.integrity.honeyfact.count = parseIntegrityHoneyfactCount(value);
      break;
    case 'honeyfact.ttl_days':
      config.integrity.honeyfact.ttl_days = parseIntegrityTtlDays(value);
      break;
    case 'tripwire.threshold':
      config.integrity.tripwire.threshold = parseIntegrityTripwireThreshold(value);
      break;
    case 'tripwire.fuzzy_enabled':
      config.integrity.tripwire.fuzzy_enabled = parseIntegrityFuzzyEnabled(value);
      break;
    case 'containment.policy':
      config.integrity.containment.policy = parseIntegrityContainmentPolicy(value);
      break;
    case 'containment.auto_escalate':
      config.integrity.containment.auto_escalate_critical = parseIntegrityAutoEscalate(value);
      break;
    default:
      console.log(chalk.red(`✗ Unknown setting: ${key}`));
      process.exit(1);
  }

  await saveConfig(config);
  console.log(chalk.green(`✓ Set ${key} = ${value}`));
  console.log();
}

/**
 * Test the tripwire monitor with sample input.
 */
async function testMonitorCommand(input: string, options: IntegrityOptions): Promise<void> {
  const config = await loadConfig();
  const tenant_id = parseIntegrityTenant(options.tenant) ?? 'default';

  const monitor = new TripwireMonitor({
    threshold: config.integrity?.tripwire.threshold ?? 0.8,
    fuzzy_enabled: config.integrity?.tripwire.fuzzy_enabled ?? true,
  });

  const result = await monitor.monitorOutput(input, tenant_id);

  if (options.json) {
    console.log(
      formatIntegrityTestJson({
        triggered: result.triggered,
        durationMs: result.duration_ms,
        eventCount: result.events.length,
        events: result.events.map((event) => ({
          id: event.id,
          honeyfactId: event.honeyfact_id,
          confidence: event.confidence,
          detectedIn: event.detected_in,
        })),
        incidentId: result.incident?.id ?? null,
        incidentSeverity: result.incident?.severity ?? null,
      }),
    );
    return;
  }

  console.log(chalk.bold('🔍 Tripwire Test'));
  console.log(chalk.dim(`  Input: "${input.slice(0, 50)}${input.length > 50 ? '...' : ''}"`));
  console.log(chalk.dim(`  Duration: ${result.duration_ms}ms`));
  console.log();

  if (!result.triggered) {
    console.log(chalk.green('✓ No honeyfacts detected'));
  } else {
    console.log(chalk.red(`✗ Detected ${result.events.length} honeyfact(s)!`));
    console.log();
    for (const event of result.events) {
      console.log(`  ${chalk.cyan(event.id)}`);
      console.log(`    Honeyfact: ${event.honeyfact_id}`);
      console.log(`    Confidence: ${(event.confidence * 100).toFixed(1)}%`);
      console.log(`    Matched: "${event.context.matched_content}"`);
    }
    if (result.incident) {
      console.log();
      console.log(chalk.yellow(`  Incident created: ${result.incident.id}`));
      console.log(`    Severity: ${result.incident.severity}`);
    }
  }
  console.log();
}

/**
 * Clear all honeyfacts for a tenant.
 */
async function clearCommand(options: IntegrityOptions): Promise<void> {
  const tenant_id = parseIntegrityTenant(options.tenant) ?? 'default';

  if (!options.force) {
    console.log(chalk.yellow('⚠️  This will delete all honeyfacts for this tenant.'));
    console.log(chalk.dim('  Use --force to confirm.'));
    process.exit(1);
  }

  const count = await clearHoneyfacts(tenant_id);

  if (options.json) {
    console.log(
      formatIntegrityClearJson({
        cleared: count,
        tenantId: tenant_id,
      }),
    );
    return;
  }

  console.log(chalk.green(`✓ Cleared ${count} honeyfacts for tenant: ${tenant_id}`));
  console.log();
}

/**
 * Show usage help.
 */
function showUsage(): void {
  console.log(chalk.bold('Memory Integrity Grid commands:'));
  console.log();
  console.log('  savestate integrity status                     Show integrity monitoring status');
  console.log('  savestate integrity seed [--count N]           Plant honeyfact memories');
  console.log('  savestate integrity rotate                     Rotate expired honeyfacts');
  console.log('  savestate integrity incidents [--status <s>]   List detected incidents');
  console.log('  savestate integrity incident <id>              Show incident details (single non-empty incident id)');
  console.log('  savestate integrity quarantine <id>            Quarantine a memory/agent');
  console.log('  savestate integrity release <id>               Release from quarantine');
  console.log('  savestate integrity config [key=value]         View/set configuration');
  console.log('  savestate integrity test "<text>"              Test tripwire with input (non-empty)');
  console.log('  savestate integrity clear --force              Clear all honeyfacts');
  console.log();
  console.log('Options:');
  console.log('  --tenant <id>     Tenant ID (single non-empty id, default: "default")');
  console.log('  --json            Output as JSON');
  console.log('  --policy <policy> Containment policy (observe, approve, or auto)');
  console.log('  --force           Force action without confirmation');
  console.log('  --reason <text>   Reason for quarantine/release (non-empty)');
  console.log('  --user <id>       User performing action (single non-empty id)');
  console.log();
}

/**
 * Register integrity commands with Commander.
 */
export function registerIntegrityCommands(program: Command): void {
  program
    .command('integrity <subcommand> [args...]')
    .description('Memory Integrity Grid - detect and contain memory poisoning (status, seed, rotate, incidents, incident, quarantine, release, config, test, clear; single non-empty subcommand: status, seed, rotate, incidents, incident, quarantine, release, config, test, or clear; incident requires a single non-empty incident id; quarantine and release require a single non-empty memory or agent id; test requires a non-empty text to check)')
    .option('--json', 'Output as JSON')
    .option('--tenant <id>', 'Tenant ID (single non-empty id, default: "default")')
    .option('--count <n>', 'Number of honeyfacts to seed')
    .option('--status <status>', 'Filter by incident status')
    .option('--policy <policy>', 'Containment policy (observe, approve, or auto)')
    .option('-f, --force', 'Force action without confirmation')
    .option('--reason <text>', 'Reason for action (non-empty)')
    .option('--user <id>', 'User performing action (single non-empty id)')
    .action(async (subcommand: string, args: string[], options: IntegrityOptions) => {
      await integrityCommand(subcommand, args, options);
    });
}
