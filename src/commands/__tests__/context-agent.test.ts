import { describe, expect, it } from 'vitest';
import { parseContextAgent } from '../context.js';

describe('savestate context --agent', () => {
  it('defaults to undefined', () => {
    expect(parseContextAgent(undefined)).toBeUndefined();
  });

  it('accepts a single agent id', () => {
    expect(parseContextAgent('default')).toBe('default');
    expect(parseContextAgent('my-agent')).toBe('my-agent');
    expect(parseContextAgent(' other-agent ')).toBe('other-agent');
  });

  it.each(['', ' ', ',', 'my-agent,other-agent', 'my agent'])('rejects invalid value %s', (value) => {
    expect(() => parseContextAgent(value)).toThrow(
      `Invalid --agent value "${value}". Expected a single non-empty agent id.`,
    );
  });
});
