/**
 * savestate schedule — Configure automatic backup schedules
 *
 * Uses launchd (macOS) or systemd timers (Linux) for reliable scheduling.
 * Requires Pro or Team subscription.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { execSync } from 'node:child_process';
import { isInitialized, loadConfig } from '../config.js';

const API_BASE = 'https://savestate.dev/api';

interface ScheduleOptions {
  every?: string;
  disable?: boolean;
  status?: boolean;
  json?: boolean;
}

export interface ScheduleStatus {
  enabled: boolean;
  running: boolean;
  supported: boolean;
  platform: string;
  intervalHours: number | null;
  job: string;
  path: string | null;
}

export function formatScheduleStatusJson(status: ScheduleStatus): string {
  return JSON.stringify(
    {
      enabled: status.enabled,
      running: status.running,
      supported: status.supported,
      platform: status.platform,
      intervalHours: status.intervalHours,
      job: status.job,
      path: status.path,
    },
    null,
    2,
  );
}

const LABEL = 'dev.savestate.autobackup';

/**
 * Verify subscription is Pro or Team
 */
async function verifySubscription(): Promise<{ valid: boolean; tier?: string; error?: string }> {
  const config = await loadConfig();
  const extConfig = config as unknown as Record<string, unknown>;
  const apiKey = extConfig.apiKey as string | undefined;

  if (!apiKey) {
    return { valid: false, error: 'Not logged in. Run `savestate login` first.' };
  }

  try {
    const res = await fetch(`${API_BASE}/account`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return { valid: false, error: 'Invalid or expired API key. Run `savestate login` to re-authenticate.' };
    }

    const account = await res.json() as { tier: string };
    const tier = account.tier.toLowerCase();

    if (tier === 'pro' || tier === 'team') {
      return { valid: true, tier };
    }

    return { valid: false, tier, error: 'Scheduled backups require a Pro or Team subscription.' };
  } catch {
    return { valid: false, error: 'Could not verify subscription. Check your internet connection.' };
  }
}

export async function scheduleCommand(options: ScheduleOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  // Status check - allowed for everyone
  if (options.status || (!options.every && !options.disable)) {
    await showStatus(options.json);
    return;
  }

  // Disable - allowed for everyone (in case subscription lapses)
  if (options.disable) {
    await disableSchedule();
    return;
  }

  // Enable with interval - requires Pro/Team
  if (options.every) {
    // Verify subscription first
    const spinner = ora('Verifying subscription...').start();
    const { valid, tier, error } = await verifySubscription();

    if (!valid) {
      spinner.fail('Subscription required');
      console.log();
      console.log(chalk.red(`  ${error}`));
      if (tier === 'free') {
        console.log();
        console.log(chalk.dim('  Upgrade at: https://savestate.dev/#pricing'));
      }
      console.log();
      process.exit(1);
    }

    spinner.succeed(`Subscription verified (${tier!.toUpperCase()})`);
    await enableSchedule(options.every);
    return;
  }
}

function getScheduleStatus(): ScheduleStatus {
  const os = platform();
  const base: ScheduleStatus = {
    enabled: false,
    running: false,
    supported: true,
    platform: os,
    intervalHours: null,
    job: LABEL,
    path: null,
  };

  if (os === 'darwin') {
    const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
    base.path = plistPath;
    if (!existsSync(plistPath)) {
      return base;
    }

    try {
      const listed = execSync(`launchctl list | grep ${LABEL}`, { encoding: 'utf-8' }).trim();
      if (listed) {
        const plist = readFileSync(plistPath, 'utf-8');
        const intervalMatch = plist.match(/<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/);
        const interval = intervalMatch ? parseInt(intervalMatch[1]) : 0;
        return {
          ...base,
          enabled: true,
          running: true,
          intervalHours: Math.round(interval / 3600),
        };
      }
    } catch {
      return { ...base, enabled: true, running: false };
    }

    return { ...base, enabled: true, running: false };
  }

  if (os === 'linux') {
    const timerPath = join(homedir(), '.config', 'systemd', 'user', `${LABEL}.timer`);
    base.path = timerPath;
    if (!existsSync(timerPath)) {
      return base;
    }

    try {
      const listed = execSync(`systemctl --user is-active ${LABEL}.timer 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
      if (listed === 'active') {
        return { ...base, enabled: true, running: true };
      }
      return { ...base, enabled: true, running: false };
    } catch {
      return { ...base, enabled: true, running: false };
    }
  }

  return { ...base, supported: false };
}

async function showStatus(asJson?: boolean): Promise<void> {
  const status = getScheduleStatus();
  if (asJson) {
    console.log(formatScheduleStatusJson(status));
    return;
  }

  const os = status.platform;

  if (!status.supported) {
    console.log(chalk.yellow(`⚠ Scheduled backups not supported on ${os}`));
    console.log(chalk.dim('  Use cron manually: */360 * * * * savestate snapshot'));
    console.log();
    return;
  }

  if (!status.enabled) {
    console.log(chalk.yellow('⏸  Scheduled backups: disabled'));
    console.log();
    console.log(chalk.dim('  Enable with: savestate schedule --every 6h'));
    console.log();
    return;
  }

  if (os === 'darwin' && status.running) {
    console.log(chalk.green(`✓ Scheduled backups: enabled`));
    console.log();
    console.log(`  ${chalk.dim('Interval:')}  every ${status.intervalHours}h`);
    console.log(`  ${chalk.dim('Job:')}       ${status.job}`);
    console.log(`  ${chalk.dim('Plist:')}     ${status.path}`);
    console.log();
    console.log(chalk.dim('  View logs: tail -f ~/Library/Logs/savestate-autobackup.log'));
    console.log(chalk.dim('  Disable:   savestate schedule --disable'));
    console.log();
    return;
  }

  if (os === 'linux' && status.running) {
    console.log(chalk.green(`✓ Scheduled backups: enabled`));
    console.log();
    console.log(`  ${chalk.dim('Timer:')} ${status.job}.timer`);
    console.log(chalk.dim('  View: systemctl --user status ' + LABEL + '.timer'));
    console.log(chalk.dim('  Logs: journalctl --user -u ' + LABEL));
    console.log();
    return;
  }

  if (os === 'darwin') {
    console.log(chalk.yellow('⏸  Scheduled backups: configured but not running'));
    console.log(chalk.dim(`   Try: launchctl load ${status.path}`));
    console.log();
    return;
  }

  if (os === 'linux') {
    console.log(chalk.yellow('⏸  Scheduled backups: configured but not running'));
    console.log();
    return;
  }

  console.log(chalk.yellow('⏸  Scheduled backups: unknown status'));
  console.log();
}

async function enableSchedule(interval: string): Promise<void> {
  const seconds = parseInterval(interval);
  if (!seconds) {
    console.log(chalk.red(`✗ Invalid interval: ${interval}`));
    console.log(chalk.dim('  Examples: 1h, 6h, 12h, 1d'));
    process.exit(1);
  }

  const hours = seconds / 3600;
  const os = platform();
  const spinner = ora(`Setting up ${hours}h backup schedule...`).start();

  try {
    if (os === 'darwin') {
      await setupMacOSSchedule(seconds);
    } else if (os === 'linux') {
      await setupLinuxSchedule(seconds);
    } else {
      spinner.fail(`Scheduled backups not supported on ${os}`);
      console.log(chalk.dim(`  Use cron: */${Math.round(seconds / 60)} * * * * savestate snapshot`));
      return;
    }

    spinner.succeed(`Scheduled backups enabled: every ${hours}h`);
    console.log();
    console.log(chalk.dim('  Your AI state will be automatically backed up.'));
    console.log(chalk.dim('  Check status: savestate schedule'));
    console.log(chalk.dim('  Disable:      savestate schedule --disable'));
    console.log();
  } catch (err) {
    spinner.fail('Failed to set up schedule');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

async function disableSchedule(): Promise<void> {
  const os = platform();
  const spinner = ora('Disabling scheduled backups...').start();

  try {
    if (os === 'darwin') {
      const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
      try {
        execSync(`launchctl unload "${plistPath}" 2>/dev/null || true`);
      } catch { /* ignore */ }
      if (existsSync(plistPath)) {
        unlinkSync(plistPath);
      }
    } else if (os === 'linux') {
      try {
        execSync(`systemctl --user stop ${LABEL}.timer 2>/dev/null || true`);
        execSync(`systemctl --user disable ${LABEL}.timer 2>/dev/null || true`);
      } catch { /* ignore */ }
      const configDir = join(homedir(), '.config', 'systemd', 'user');
      const timerPath = join(configDir, `${LABEL}.timer`);
      const servicePath = join(configDir, `${LABEL}.service`);
      if (existsSync(timerPath)) unlinkSync(timerPath);
      if (existsSync(servicePath)) unlinkSync(servicePath);
    }

    spinner.succeed('Scheduled backups disabled');
    console.log();
  } catch (err) {
    spinner.fail('Failed to disable schedule');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
  }
}

// ─── Platform-specific setup ────────────────────────────────

async function setupMacOSSchedule(intervalSeconds: number): Promise<void> {
  const launchAgentsDir = join(homedir(), 'Library', 'LaunchAgents');
  const plistPath = join(launchAgentsDir, `${LABEL}.plist`);
  const logPath = join(homedir(), 'Library', 'Logs', 'savestate-autobackup.log');

  // Find the savestate binary
  const savestateCmd = findSavestateCommand();

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${savestateCmd}</string>
    <string>snapshot</string>
    <string>--label</string>
    <string>auto</string>
  </array>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>WorkingDirectory</key>
  <string>${process.cwd()}</string>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>`;

  // Ensure directory exists
  if (!existsSync(launchAgentsDir)) {
    mkdirSync(launchAgentsDir, { recursive: true });
  }

  // Unload existing if present
  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null || true`);
  } catch { /* ignore */ }

  // Write and load
  writeFileSync(plistPath, plist);
  execSync(`launchctl load "${plistPath}"`);
}

async function setupLinuxSchedule(intervalSeconds: number): Promise<void> {
  const configDir = join(homedir(), '.config', 'systemd', 'user');
  const timerPath = join(configDir, `${LABEL}.timer`);
  const servicePath = join(configDir, `${LABEL}.service`);

  const savestateCmd = findSavestateCommand();
  const hours = Math.round(intervalSeconds / 3600);

  const service = `[Unit]
Description=SaveState automatic backup

[Service]
Type=oneshot
WorkingDirectory=${process.cwd()}
ExecStart=${savestateCmd} snapshot --label auto
`;

  const timer = `[Unit]
Description=SaveState automatic backup timer

[Timer]
OnBootSec=5min
OnUnitActiveSec=${hours}h
Persistent=true

[Install]
WantedBy=timers.target
`;

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Write units
  writeFileSync(servicePath, service);
  writeFileSync(timerPath, timer);

  // Enable and start
  execSync('systemctl --user daemon-reload');
  execSync(`systemctl --user enable ${LABEL}.timer`);
  execSync(`systemctl --user start ${LABEL}.timer`);
}

// ─── Helpers ────────────────────────────────────────────────

function parseInterval(interval: string): number | null {
  const match = interval.match(/^(\d+)(h|d|m)$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return null;
  }
}

function findSavestateCommand(): string {
  // Check if we're running via npx/node
  const execPath = process.argv[1];

  // Try to find a global or local installation
  try {
    const which = execSync('which savestate 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (which) return which;
  } catch { /* ignore */ }

  // Fall back to npx
  return 'npx savestate';
}
