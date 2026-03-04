/**
 * Failure Antibody compiler tests
 */

import { describe, expect, it } from 'vitest';
import { AntibodyCompiler } from '../compiler.js';
import type { FailureEvent } from '../types.js';

describe('AntibodyCompiler', () => {
  it('compiles deterministic rules independent of event order', () => {
    const events: FailureEvent[] = [
      {
        id: 'evt_1',
        type: 'user_correction',
        timestamp: '2026-02-20T01:00:00.000Z',
        tool: 'filesystem',
        path: '/workspace/app/config.json',
        correction_code: 'missing_permission',
        error_code: 'EACCES',
      },
      {
        id: 'evt_2',
        type: 'tool_failure',
        timestamp: '2026-02-20T02:00:00.000Z',
        tool: 'filesystem',
        error_code: 'ENOENT',
        hard: true,
        path: '/workspace/app/missing.txt',
      },
    ];

    const compiler = new AntibodyCompiler();
    const compiledA = compiler.compile(events);
    const compiledB = compiler.compile([...events].reverse());

    expect(compiledA).toEqual(compiledB);
    expect(compiledA).toHaveLength(2);
    expect(compiledA.every((rule) => rule.intervention === 'warn')).toBe(true);
  });

  it('only compiles hard tool failures', () => {
    const events: FailureEvent[] = [
      {
        id: 'evt_soft',
        type: 'tool_failure',
        timestamp: '2026-02-20T03:00:00.000Z',
        tool: 'network',
        error_code: 'ECONNRESET',
        hard: false,
      },
      {
        id: 'evt_hard',
        type: 'tool_failure',
        timestamp: '2026-02-20T04:00:00.000Z',
        tool: 'network',
        error_code: 'ECONNRESET',
        hard: true,
      },
    ];

    const compiler = new AntibodyCompiler();
    const compiled = compiler.compile(events);

    expect(compiled).toHaveLength(1);
    expect(compiled[0].source_event_ids).toEqual(['evt_hard']);
    expect(compiled[0].safe_action.type).toBe('retry_with_backoff');
  });

  it('maps user correction codes to deterministic safe actions', () => {
    const compiler = new AntibodyCompiler();
    const rule = compiler.compileEvent({
      id: 'evt_user_1',
      type: 'user_correction',
      timestamp: '2026-02-20T05:00:00.000Z',
      tool: 'filesystem',
      correction_code: 'wrong_path',
    });

    expect(rule).not.toBeNull();
    expect(rule?.safe_action.type).toBe('validate_inputs');
    expect(rule?.confidence).toBe(0.9);
  });
});

