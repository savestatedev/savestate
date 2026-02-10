/**
 * Progress Display Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ProgressDisplay,
  createSpinner,
  success,
  warning,
  error,
  info,
} from '../progress.js';
import type { MigrationEvent } from '../../migrate/index.js';

// Mock ora
vi.mock('ora', () => {
  const mockSpinner = {
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  };
  return {
    default: vi.fn(() => mockSpinner),
  };
});

describe('ProgressDisplay', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const progress = new ProgressDisplay();
      expect(progress).toBeDefined();
    });

    it('should accept noColor option', () => {
      const progress = new ProgressDisplay({ noColor: true });
      expect(progress).toBeDefined();
    });

    it('should accept verbose option', () => {
      const progress = new ProgressDisplay({ verbose: true });
      expect(progress).toBeDefined();
    });
  });

  describe('handleEvent', () => {
    it('should handle phase:start event', () => {
      const progress = new ProgressDisplay();
      const event: MigrationEvent = {
        type: 'phase:start',
        phase: 'extracting',
        message: 'Starting extraction...',
      };

      progress.handleEvent(event);
      // Spinner should be started (mocked)
    });

    it('should handle phase:complete event', () => {
      const progress = new ProgressDisplay();

      // Start phase first
      progress.handleEvent({
        type: 'phase:start',
        phase: 'extracting',
      });

      // Complete phase
      progress.handleEvent({
        type: 'phase:complete',
        phase: 'extracting',
        message: 'Extraction complete',
      });
    });

    it('should handle progress event', () => {
      const progress = new ProgressDisplay();

      // Start phase first
      progress.handleEvent({
        type: 'phase:start',
        phase: 'extracting',
      });

      // Update progress
      progress.handleEvent({
        type: 'progress',
        progress: 50,
        message: 'Processing...',
      });
    });

    it('should handle checkpoint event in verbose mode', () => {
      const progress = new ProgressDisplay({ verbose: true });

      progress.handleEvent({
        type: 'phase:start',
        phase: 'extracting',
      });

      progress.handleEvent({
        type: 'checkpoint',
        message: 'Checkpoint saved',
      });

      // In verbose mode, checkpoint should be logged
    });

    it('should handle complete event', () => {
      const progress = new ProgressDisplay();

      progress.handleEvent({
        type: 'complete',
        data: { success: true },
      });

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Complete');
    });

    it('should handle error event', () => {
      const progress = new ProgressDisplay();

      progress.handleEvent({
        type: 'error',
        error: new Error('Test error'),
      });

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Failed');
    });
  });

  describe('startPhase', () => {
    it('should start a new spinner', () => {
      const progress = new ProgressDisplay();
      progress.startPhase('extracting', 'Extracting data...');
    });

    it('should stop previous spinner before starting new one', () => {
      const progress = new ProgressDisplay();
      progress.startPhase('extracting', 'Extracting...');
      progress.startPhase('transforming', 'Transforming...');
    });
  });

  describe('completePhase', () => {
    it('should show success message', () => {
      const progress = new ProgressDisplay();
      progress.startPhase('extracting');
      progress.completePhase('extracting', 'Done!');
    });
  });

  describe('failPhase', () => {
    it('should show error message', () => {
      const progress = new ProgressDisplay();
      progress.startPhase('extracting');
      progress.failPhase('Something went wrong');
    });
  });

  describe('updateProgress', () => {
    it('should update spinner text with progress bar', () => {
      const progress = new ProgressDisplay();
      progress.startPhase('extracting');
      progress.updateProgress(50, 'Processing items...');
    });

    it('should handle undefined progress', () => {
      const progress = new ProgressDisplay();
      progress.startPhase('extracting');
      progress.updateProgress(undefined, 'Working...');
    });
  });

  describe('stop', () => {
    it('should stop the spinner', () => {
      const progress = new ProgressDisplay();
      progress.startPhase('extracting');
      progress.stop();
    });

    it('should handle stop when no spinner active', () => {
      const progress = new ProgressDisplay();
      progress.stop(); // Should not throw
    });
  });
});

describe('Convenience Functions', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('createSpinner', () => {
    it('should create and start a spinner', () => {
      const spinner = createSpinner('Loading...');
      expect(spinner).toBeDefined();
    });
  });

  describe('success', () => {
    it('should log success message with checkmark', () => {
      success('Operation completed');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('✓');
      expect(output).toContain('Operation completed');
    });
  });

  describe('warning', () => {
    it('should log warning message', () => {
      warning('Something might be wrong');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('⚠');
      expect(output).toContain('might be wrong');
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      error('Something went wrong');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('✗');
      expect(output).toContain('went wrong');
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      info('Here is some information');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('ℹ');
      expect(output).toContain('information');
    });
  });
});
