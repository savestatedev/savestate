/**
 * savestate schedule — Configure automatic backup schedules
 *
 * Uses launchd (macOS) or systemd timers (Linux) for reliable scheduling.
 * Requires Pro or Team tier for cloud-backed schedules.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { execSync } from 'node:child_process';
import { isInitialized, loadConfig } from '../config.js';

interface ScheduleOptions {
  every?: string;
  disable?: boolean;
  status?: boolean;
}

const LABEL = 'dev.savestate.autobackup';

export async function scheduleCommand(options: ScheduleOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  // Status check
  if (options.status || (!options.every && !options.disable)) {
    await showStatus();
    return;
  }

  // Disable
  if (options.disable) {
    await disableSchedule();
    return;
  }

  // Enable with interval
  if (options.every) {
    await enableSchedule(options.every);
    return;
  }
}

async function showStatus(): Promise<void> {
  const os = platform();

  if (os === 'darwin') {
    // macOS - check launchd
    const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

    if (!existsSync(plistPath)) {
      console.log(chalk.yellow('⏸  Scheduled backups: disabled'));
      console.log();
      console.log(chalk.dim('  Enable with: savestate schedule --every 6h'));
      console.log();
      return;
    }

    try {
      const status = execSync(`launchctl list | grep ${LABEL}`, { encoding: 'utf-8' }).trim();
      if (status) {
        const plist = readFileSync(plistPath, 'utf-8');
        const intervalMatch = plist.match(/<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/);
        const interval = intervalMatch ? parseInt(intervalMatch[1]) : 0;
        const hours = Math.round(interval / 3600);

        console.log(chalk.green(`✓ Scheduled backups: enabled`));
        console.log();
        console.log(`  ${chalk.dim('Interval:')}  every ${hours}h`);
        console.log(`  ${chalk.dim('Job:')}       ${LABEL}`);
        console.log(`  ${chalk.dim('Plist:')}     ${plistPath}`);
        console.log();
        console.log(chalk.dim('  View logs: tail -f ~/Library/Logs/savestate-autobackup.log'));
        console.log(chalk.dim('  Disable:   savestate schedule --disable'));
        console.log();
      }
    } catch {
      console.log(chalk.yellow('⏸  Scheduled backups: configured but not running'));
      console.log(chalk.dim(`   Try: launchctl load ${plistPath}`));
      console.log();
    }
    return;
  }

  if (os === 'linux') {
    // Linux - check systemd timer
    const timerPath = join(homedir(), '.config', 'systemd', 'user', `${LABEL}.timer`);

    if (!existsSync(timerPath)) {
      console.log(chalk.yellow('⏸  Scheduled backups: disabled'));
      console.log();
      console.log(chalk.dim('  Enable with: savestate schedule --every 6h'));
      console.log();
      return;
    }

    try {
      const status = execSync(`systemctl --user is-active ${LABEL}.timer 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
      if (status === 'active') {
        console.log(chalk.green(`✓ Scheduled backups: enabled`));
        console.log();
        console.log(`  ${chalk.dim('Timer:')} ${LABEL}.timer`);
        console.log(chalk.dim('  View: systemctl --user status ' + LABEL + '.timer'));
        console.log(chalk.dim('  Logs: journalctl --user -u ' + LABEL));
        console.log();
      } else {
        console.log(chalk.yellow('⏸  Scheduled backups: configured but not running'));
        console.log();
      }
    } catch {
      console.log(chalk.yellow('⏸  Scheduled backups: unknown status'));
      console.log();
    }
    return;
  }

  console.log(chalk.yellow(`⚠ Scheduled backups not supported on ${os}`));
  console.log(chalk.dim('  Use cron manually: */360 * * * * savestate snapshot'));
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
