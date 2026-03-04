/**
 * Signal Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SignalHandler,
  setupSignalHandler,
  cleanupSignalHandler,
  getSignalHandler,
} from '../signal-handler.js';

describe('SignalHandler', () => {
  let processOnSpy: ReturnType<typeof vi.spyOn>;
  let processOffSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    processOffSpy = vi.spyOn(process, 'off').mockImplementation(() => process);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    processOnSpy.mockRestore();
    processOffSpy.mockRestore();
    consoleSpy.mockRestore();
    cleanupSignalHandler();
  });

  describe('register', () => {
    it('should register signal handlers', () => {
      const handler = new SignalHandler();
      handler.register();

      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('unregister', () => {
    it('should unregister signal handlers', () => {
      const handler = new SignalHandler();
      handler.register();
      handler.unregister();

      expect(processOffSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOffSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });
  });

  describe('setupSignalHandler', () => {
    it('should create and register a global handler', () => {
      const handler = setupSignalHandler();

      expect(handler).toBeInstanceOf(SignalHandler);
      expect(getSignalHandler()).toBe(handler);
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should replace existing handler', () => {
      const handler1 = setupSignalHandler();
      const handler2 = setupSignalHandler();

      expect(getSignalHandler()).toBe(handler2);
      expect(getSignalHandler()).not.toBe(handler1);
    });
  });

  describe('cleanupSignalHandler', () => {
    it('should unregister and clear global handler', () => {
      setupSignalHandler();
      expect(getSignalHandler()).not.toBeNull();

      cleanupSignalHandler();
      expect(getSignalHandler()).toBeNull();
    });
  });

  describe('setOrchestrator', () => {
    it('should allow updating orchestrator reference', () => {
      const handler = new SignalHandler();
      const mockOrchestrator = {
        getState: () => ({
          id: 'test',
          phase: 'extracting',
          progress: 50,
        }),
      } as any;

      // Should not throw
      handler.setOrchestrator(mockOrchestrator);
    });
  });

  describe('options', () => {
    it('should respect showResumeHint option', () => {
      const handler = new SignalHandler({
        showResumeHint: false,
      });

      // Internal state check - showResumeHint should be false
      expect((handler as any).showResumeHint).toBe(false);
    });

    it('should use custom message', () => {
      const handler = new SignalHandler({
        message: 'Custom interrupt message',
      });

      expect((handler as any).message).toBe('Custom interrupt message');
    });

    it('should accept cleanup function', () => {
      const cleanup = vi.fn();
      const handler = new SignalHandler({
        cleanup,
      });

      expect((handler as any).cleanup).toBe(cleanup);
    });
  });
});
