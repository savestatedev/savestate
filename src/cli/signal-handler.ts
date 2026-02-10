/**
 * Signal Handler
 *
 * Graceful handling of Ctrl+C (SIGINT) and other signals.
 * Ensures cleanup happens and migrations can be resumed.
 */

import chalk from 'chalk';
import type { MigrationOrchestrator } from '../migrate/index.js';

// ─── Types ───────────────────────────────────────────────────

export interface SignalHandlerOptions {
  /** Orchestrator to save state on interrupt */
  orchestrator?: MigrationOrchestrator;
  /** Custom cleanup function */
  cleanup?: () => Promise<void>;
  /** Message to show on interrupt */
  message?: string;
  /** Whether to show resume hint */
  showResumeHint?: boolean;
}

// ─── Signal Handler Class ────────────────────────────────────

export class SignalHandler {
  private orchestrator?: MigrationOrchestrator;
  private cleanup?: () => Promise<void>;
  private message: string;
  private showResumeHint: boolean;
  private isHandling = false;
  private interruptCount = 0;

  constructor(options: SignalHandlerOptions = {}) {
    this.orchestrator = options.orchestrator;
    this.cleanup = options.cleanup;
    this.message = options.message ?? 'Migration interrupted.';
    this.showResumeHint = options.showResumeHint ?? true;
  }

  /**
   * Register signal handlers
   */
  register(): void {
    process.on('SIGINT', this.handleInterrupt);
    process.on('SIGTERM', this.handleInterrupt);

    // Handle uncaught errors
    process.on('uncaughtException', this.handleUncaughtError);
    process.on('unhandledRejection', this.handleUnhandledRejection);
  }

  /**
   * Unregister signal handlers
   */
  unregister(): void {
    process.off('SIGINT', this.handleInterrupt);
    process.off('SIGTERM', this.handleInterrupt);
    process.off('uncaughtException', this.handleUncaughtError);
    process.off('unhandledRejection', this.handleUnhandledRejection);
  }

  /**
   * Update the orchestrator reference
   */
  setOrchestrator(orchestrator: MigrationOrchestrator): void {
    this.orchestrator = orchestrator;
  }

  /**
   * Handle SIGINT/SIGTERM
   */
  private handleInterrupt = async (): Promise<void> => {
    this.interruptCount++;

    // Force exit on second interrupt
    if (this.interruptCount > 1) {
      console.log();
      console.log(chalk.red('Force quit.'));
      process.exit(1);
    }

    // Prevent concurrent handling
    if (this.isHandling) {
      return;
    }
    this.isHandling = true;

    console.log();
    console.log();
    console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow.bold('  ⏸ Migration Interrupted'));
    console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();

    // Save state if we have an orchestrator
    if (this.orchestrator) {
      const state = this.orchestrator.getState();
      console.log(chalk.yellow(`  ${this.message}`));
      console.log();
      console.log(chalk.white(`  Phase: ${state.phase}`));
      console.log(chalk.white(`  Progress: ${Math.round(state.progress)}%`));
      console.log();

      if (this.showResumeHint) {
        console.log(chalk.dim(`  Your progress has been saved.`));
        console.log(chalk.dim(`  Resume with: ${chalk.cyan('savestate migrate --resume')}`));
        console.log(chalk.dim(`  Migration ID: ${state.id}`));
        console.log();
      }
    }

    // Run custom cleanup
    if (this.cleanup) {
      try {
        console.log(chalk.dim('  Cleaning up...'));
        await this.cleanup();
      } catch (error) {
        console.log(chalk.red(`  Cleanup error: ${error}`));
      }
    }

    console.log(chalk.dim('  Press Ctrl+C again to force quit.'));
    console.log();

    // Exit gracefully
    setTimeout(() => {
      process.exit(130); // 128 + SIGINT(2)
    }, 100);
  };

  /**
   * Handle uncaught exceptions
   */
  private handleUncaughtError = async (error: Error): Promise<void> => {
    console.error();
    console.error(chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.error(chalk.red.bold('  ✗ Unexpected Error'));
    console.error(chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.error();
    console.error(chalk.red(`  ${error.message}`));
    console.error();

    if (this.orchestrator && this.showResumeHint) {
      const state = this.orchestrator.getState();
      console.error(chalk.dim(`  Migration state saved. Resume with:`));
      console.error(chalk.dim(`  savestate migrate --resume`));
      console.error(chalk.dim(`  Migration ID: ${state.id}`));
      console.error();
    }

    if (this.cleanup) {
      try {
        await this.cleanup();
      } catch {
        // Ignore cleanup errors during crash
      }
    }

    process.exit(1);
  };

  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection = (reason: unknown): void => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.handleUncaughtError(error);
  };
}

// ─── Convenience Function ────────────────────────────────────

let globalHandler: SignalHandler | null = null;

/**
 * Setup global signal handling
 */
export function setupSignalHandler(options: SignalHandlerOptions = {}): SignalHandler {
  if (globalHandler) {
    globalHandler.unregister();
  }

  globalHandler = new SignalHandler(options);
  globalHandler.register();
  return globalHandler;
}

/**
 * Get the current signal handler
 */
export function getSignalHandler(): SignalHandler | null {
  return globalHandler;
}

/**
 * Cleanup signal handling
 */
export function cleanupSignalHandler(): void {
  if (globalHandler) {
    globalHandler.unregister();
    globalHandler = null;
  }
}
