import { describe, expect, it } from 'vitest';
import { formatMcpResourceReadError } from '../server.js';

describe('MCP resource read errors', () => {
  it('preserves Error instances for protocol-level failures', () => {
    const error = new Error('resource unavailable');

    expect(formatMcpResourceReadError(error)).toBe(error);
  });

  it('normalizes non-Error failures into Error instances', () => {
    expect(formatMcpResourceReadError('resource unavailable')).toEqual(
      new Error('resource unavailable'),
    );
  });
});
