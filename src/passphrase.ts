/**
 * SaveState Passphrase Handling
 *
 * Secure passphrase input with env var fallback.
 * - SAVESTATE_PASSPHRASE env var (for non-interactive / CI)
 * - Interactive TTY prompt with hidden input
 * - Minimum 8 characters validation
 * - Optional confirmation (type twice)
 */

import { createInterface } from 'node:readline';

const MIN_LENGTH = 8;

/**
 * Get a passphrase from the environment or interactive prompt.
 *
 * Priority:
 * 1. SAVESTATE_PASSPHRASE environment variable
 * 2. Interactive TTY prompt with hidden input
 *
 * @param options.confirm - Require typing the passphrase twice
 * @returns The validated passphrase
 */
export async function getPassphrase(options?: { confirm?: boolean }): Promise<string> {
  // Check env var first
  const envPassphrase = process.env.SAVESTATE_PASSPHRASE;
  if (envPassphrase) {
    validatePassphrase(envPassphrase);
    return envPassphrase;
  }

  // Must be interactive TTY
  if (!process.stdin.isTTY) {
    throw new Error(
      'No passphrase available. Set SAVESTATE_PASSPHRASE environment variable ' +
      'or run in an interactive terminal.',
    );
  }

  const passphrase = await promptHidden('🔑 Enter passphrase: ');
  validatePassphrase(passphrase);

  if (options?.confirm) {
    const confirm = await promptHidden('🔑 Confirm passphrase: ');
    if (passphrase !== confirm) {
      throw new Error('Passphrases do not match.');
    }
  }

  return passphrase;
}

/**
 * Validate passphrase meets minimum requirements.
 */
function validatePassphrase(passphrase: string): void {
  if (!passphrase || passphrase.length < MIN_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_LENGTH} characters.`);
  }
}

/**
 * Prompt for input with hidden characters (no echo).
 * Uses readline with output suppression for secure input.
 */
function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Write prompt directly
    process.stderr.write(prompt);

    // Create a writable that swallows everything (mute echo)
    const muted = new (require('node:stream').Writable)({
      write(_chunk: Buffer, _encoding: string, callback: () => void) {
        callback();
      },
    });

    const rl = createInterface({
      input: process.stdin,
      output: muted,
      terminal: true,
    });

    rl.question('', (answer) => {
      rl.close();
      process.stderr.write('\n');
      resolve(answer);
    });

    rl.on('error', (err: Error) => {
      rl.close();
      reject(err);
    });
  });
}
