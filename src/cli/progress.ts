/**
 * Progress Display
 *
 * Enhanced progress indicators for migration phases.
 * Uses ora spinners with phase-specific styling.
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';
import type { MigrationPhase, MigrationEvent } from '../migrate/index.js';

// ─── Types ───────────────────────────────────────────────────

export interface PhaseProgress {
  phase: MigrationPhase;
  spinner: Ora;
  startTime: number;
}

export interface ProgressDisplayOptions {
  /** Disable colors */
  noColor?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

// ─── Phase Icons & Colors ────────────────────────────────────

const PHASE_CONFIG: Record<MigrationPhase, { icon: string; color: (s: string) => string; label: string }> = {
  pending: { icon: '○', color: chalk.dim, label: 'Pending' },
  extracting: { icon: '📤', color: chalk.blue, label: 'Extracting' },
  transforming: { icon: '🔄', color: chalk.yellow, label: 'Transforming' },
  loading: { icon: '📥', color: chalk.magenta, label: 'Loading' },
  complete: { icon: '✓', color: chalk.green, label: 'Complete' },
  failed: { icon: '✗', color: chalk.red, label: 'Failed' },
};

// ─── Progress Display Class ──────────────────────────────────

export class ProgressDisplay {
  private spinner: Ora | null = null;
  private currentPhase: MigrationPhase = 'pending';
  private phaseStartTime: number = 0;
  private verbose: boolean;
  private noColor: boolean;

  constructor(options: ProgressDisplayOptions = {}) {
    this.verbose = options.verbose ?? false;
    this.noColor = options.noColor ?? false;
  }

  /**
   * Handle migration events
   */
  handleEvent = (event: MigrationEvent): void => {
    switch (event.type) {
      case 'phase:start':
        this.startPhase(event.phase!, event.message);
        break;
      case 'phase:complete':
        this.completePhase(event.phase!, event.message);
        break;
      case 'phase:error':
        this.failPhase(event.error?.message || 'Unknown error');
        break;
      case 'progress':
        this.updateProgress(event.progress, event.message);
        break;
      case 'checkpoint':
        if (this.verbose) {
          this.log(chalk.dim(`  ⟳ Checkpoint: ${event.message}`));
        }
        break;
      case 'complete':
        this.showComplete(event.data);
        break;
      case 'error':
        this.showError(event.error);
        break;
    }
  };

  /**
   * Start a new phase
   */
  startPhase(phase: MigrationPhase, message?: string): void {
    if (this.spinner) {
      this.spinner.stop();
    }

    this.currentPhase = phase;
    this.phaseStartTime = Date.now();

    const config = PHASE_CONFIG[phase];
    const text = message || `${config.label}...`;

    this.spinner = ora({
      text: `${config.icon} ${text}`,
      color: this.noColor ? undefined : 'cyan',
    }).start();
  }

  /**
   * Complete current phase
   */
  completePhase(phase: MigrationPhase, message?: string): void {
    const elapsed = this.formatElapsed(Date.now() - this.phaseStartTime);
    const config = PHASE_CONFIG[phase];

    if (this.spinner) {
      const text = message || config.label;
      this.spinner.succeed(`${config.icon} ${text} ${chalk.dim(`(${elapsed})`)}`);
      this.spinner = null;
    }
  }

  /**
   * Fail current phase
   */
  failPhase(errorMessage: string): void {
    if (this.spinner) {
      this.spinner.fail(`Failed: ${errorMessage}`);
      this.spinner = null;
    }
  }

  /**
   * Update progress percentage
   */
  updateProgress(progress?: number, message?: string): void {
    if (!this.spinner) return;

    const config = PHASE_CONFIG[this.currentPhase];
    let text = message || config.label;

    if (progress !== undefined) {
      const percent = Math.round(progress);
      const bar = this.createProgressBar(progress);
      text = `${text} ${bar} ${percent}%`;
    }

    this.spinner.text = `${config.icon} ${text}`;
  }

  /**
   * Show completion summary
   */
  showComplete(data?: unknown): void {
    console.log();
    console.log(chalk.green.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.green.bold('  ✓ Migration Complete!'));
    console.log(chalk.green.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();
  }

  /**
   * Show error
   */
  showError(error?: Error): void {
    console.log();
    console.log(chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.red.bold('  ✗ Migration Failed'));
    console.log(chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    if (error) {
      console.log();
      console.log(chalk.red(`  ${error.message}`));
    }
    console.log();
  }

  /**
   * Log a message (preserving spinner)
   */
  log(message: string): void {
    if (this.spinner) {
      this.spinner.stop();
      console.log(message);
      this.spinner.start();
    } else {
      console.log(message);
    }
  }

  /**
   * Stop spinner (cleanup)
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private createProgressBar(progress: number, width = 20): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return this.noColor ? `[${bar}]` : chalk.cyan(`[${bar}]`);
  }

  private formatElapsed(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

// ─── Convenience Functions ───────────────────────────────────

/**
 * Create a simple spinner
 */
export function createSpinner(text: string): Ora {
  return ora({ text }).start();
}

/**
 * Show a success message with checkmark
 */
export function success(message: string): void {
  console.log(chalk.green('✓') + ' ' + message);
}

/**
 * Show a warning message
 */
export function warning(message: string): void {
  console.log(chalk.yellow('⚠') + ' ' + message);
}

/**
 * Show an error message
 */
export function error(message: string): void {
  console.log(chalk.red('✗') + ' ' + message);
}

/**
 * Show an info message
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ') + ' ' + message);
}
