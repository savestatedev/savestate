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

/**
 * Main integrity command handler.
 */
export async function integrityCommand(
  subcommand: string,
  args: string[],
  options: IntegrityOptions,
): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
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
      await incidentDetailCommand(args[0], options);
      return;
    case 'quarantine':
      await quarantineCommand(args[0], options);
      return;
    case 'release':
      await releaseCommand(args[0], options);
      return;
    case 'config':
      await configCommand(args[0], options);
      return;
    case 'test':
      await testMonitorCommand(args[0], options);
      return;
    case 'clear':
      await clearCommand(options);
      return;
    default:
      showUsage();
      process.exit(1);
  }
}

/**
 * Show integrity monitoring status.
 */
async function showStatus(options: IntegrityOptions): Promise<void> {
  const config = await loadConfig();
  const tenant_id = options.tenant ?? 'default';

  const honeyfactStats = await getHoneyfactStats(tenant_id);
  const incidentStats = await getIncidentStats(tenant_id);
  const controller = new ContainmentController();
  const containmentStatus = await controller.getStatus();

  if (options.json) {
    console.log(JSON.stringify({
      enabled: config.integrity?.enabled ?? false,
      honeyfacts: honeyfactStats,
      incidents: incidentStats,
      containment: containmentStatus,
    }, null, 2));
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
  const tenant_id = options.tenant ?? 'default';
  const count = options.count ? parseInt(options.count, 10) : (config.integrity?.honeyfact.count ?? 10);
  const ttl_days = config.integrity?.honeyfact.ttl_days ?? 7;

  console.log(chalk.dim(`  Seeding ${count} honeyfacts for tenant: ${tenant_id}`));

  const result = await seedHoneyfacts('integrity', count, {
    tenant_id,
    ttl_days,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
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
  const tenant_id = options.tenant ?? 'default';
  const ttl_days = config.integrity?.honeyfact.ttl_days ?? 7;

  const result = await rotateHoneyfacts({
    tenant_id,
    ttl_days,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
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
  const tenant_id = options.tenant;
  const status = options.status as IntegrityIncident['status'] | undefined;

  const incidents = await getIncidents(tenant_id, status);

  if (options.json) {
    console.log(JSON.stringify(incidents, null, 2));
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
  if (!id) {
    console.log(chalk.red('✗ Incident ID required'));
    console.log(chalk.dim('  Usage: savestate integrity incident <id>'));
    process.exit(1);
  }

  const incident = await getIncident(id);

  if (!incident) {
    console.log(chalk.red(`✗ Incident not found: ${id}`));
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(incident, null, 2));
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

  const reason = options.reason ?? 'Manual quarantine via CLI';
  const controller = new ContainmentController();

  // Determine if it's a memory or agent based on prefix
  const isAgent = id.startsWith('agent_') || id.startsWith('session_');

  let result;
  if (isAgent) {
    result = await controller.quarantineAgent(id, reason, {
      initiated_by: options.user ?? 'cli',
      tenant_id: options.tenant ?? 'default',
      force: options.force,
    });
  } else {
    result = await controller.quarantineMemory(id, reason, {
      initiated_by: options.user ?? 'cli',
      tenant_id: options.tenant ?? 'default',
      force: options.force,
    });
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
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

  const reason = options.reason ?? 'Released via CLI';
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
      const result = await controller.dismissApproval(id, options.user ?? 'cli', reason);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(chalk.green(`✓ Approval dismissed: ${id}`));
      console.log();
      return;
    }

    console.log(chalk.red(`✗ Not found in quarantine: ${id}`));
    process.exit(1);
  }

  let result;
  if (isAgent) {
    result = await controller.releaseAgent(id, reason, options.user ?? 'cli');
  } else {
    result = await controller.releaseMemory(id, reason, options.user ?? 'cli');
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
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
      console.log(JSON.stringify(config.integrity, null, 2));
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
      config.integrity.enabled = value === 'true';
      break;
    case 'honeyfact.count':
      config.integrity.honeyfact.count = parseInt(value, 10);
      break;
    case 'honeyfact.ttl_days':
      config.integrity.honeyfact.ttl_days = parseInt(value, 10);
      break;
    case 'tripwire.threshold':
      config.integrity.tripwire.threshold = parseFloat(value);
      break;
    case 'tripwire.fuzzy_enabled':
      config.integrity.tripwire.fuzzy_enabled = value === 'true';
      break;
    case 'containment.policy':
      if (!['observe', 'approve', 'auto'].includes(value)) {
        console.log(chalk.red(`✗ Invalid policy: ${value}`));
        console.log(chalk.dim('  Allowed: observe, approve, auto'));
        process.exit(1);
      }
      config.integrity.containment.policy = value as ContainmentPolicy;
      break;
    case 'containment.auto_escalate':
      config.integrity.containment.auto_escalate_critical = value === 'true';
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
async function testMonitorCommand(input: string | undefined, options: IntegrityOptions): Promise<void> {
  if (!input) {
    console.log(chalk.red('✗ Test input required'));
    console.log(chalk.dim('  Usage: savestate integrity test "<text to check>"'));
    process.exit(1);
  }

  const config = await loadConfig();
  const tenant_id = options.tenant ?? 'default';

  const monitor = new TripwireMonitor({
    threshold: config.integrity?.tripwire.threshold ?? 0.8,
    fuzzy_enabled: config.integrity?.tripwire.fuzzy_enabled ?? true,
  });

  const result = await monitor.monitorOutput(input, tenant_id);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
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
  const tenant_id = options.tenant ?? 'default';

  if (!options.force) {
    console.log(chalk.yellow('⚠️  This will delete all honeyfacts for this tenant.'));
    console.log(chalk.dim('  Use --force to confirm.'));
    process.exit(1);
  }

  const count = await clearHoneyfacts(tenant_id);
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
  console.log('  savestate integrity incident <id>              Show incident details');
  console.log('  savestate integrity quarantine <id>            Quarantine a memory/agent');
  console.log('  savestate integrity release <id>               Release from quarantine');
  console.log('  savestate integrity config [key=value]         View/set configuration');
  console.log('  savestate integrity test "<text>"              Test tripwire with input');
  console.log('  savestate integrity clear --force              Clear all honeyfacts');
  console.log();
  console.log('Options:');
  console.log('  --tenant <id>     Tenant ID (default: "default")');
  console.log('  --json            Output as JSON');
  console.log('  --force           Force action without confirmation');
  console.log('  --reason <text>   Reason for quarantine/release');
  console.log('  --user <id>       User performing action');
  console.log();
}

/**
 * Register integrity commands with Commander.
 */
export function registerIntegrityCommands(program: Command): void {
  program
    .command('integrity [subcommand] [args...]')
    .description('Memory Integrity Grid - detect and contain memory poisoning')
    .option('--json', 'Output as JSON')
    .option('--tenant <id>', 'Tenant ID')
    .option('--count <n>', 'Number of honeyfacts to seed')
    .option('--status <status>', 'Filter by incident status')
    .option('--policy <policy>', 'Containment policy')
    .option('-f, --force', 'Force action without confirmation')
    .option('--reason <text>', 'Reason for action')
    .option('--user <id>', 'User performing action')
    .action(async (subcommand: string | undefined, args: string[], options: IntegrityOptions) => {
      if (!subcommand) {
        showUsage();
        return;
      }
      await integrityCommand(subcommand, args, options);
    });
}
