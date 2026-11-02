import { describe, expect, it } from 'vitest';
import { formatVerifyResult, verifyExitCode, type VerifyPagination, type VerifyResult } from '../verify.js';

const validResult: VerifyResult = {
  status: 'valid',
  message: 'State file is valid and verified',
  manifest: {
    agentId: 'demo-agent',
    created: '2026-08-18T05:00:00.000Z',
    formatVersion: 1,
  },
};

describe('savestate verify --json', () => {
  it('prints status, message, and manifest fields', () => {
    const parsed = JSON.parse(formatVerifyResult(validResult, true)) as VerifyResult;
    expect(parsed.status).toBe('valid');
    expect(parsed.message).toBe('State file is valid and verified');
    expect(parsed.manifest?.agentId).toBe('demo-agent');
    expect(parsed.manifest?.created).toBe('2026-08-18T05:00:00.000Z');
    expect(parsed.manifest?.formatVersion).toBe(1);
  });

  it('keeps human text when --json is omitted', () => {
    const text = formatVerifyResult(validResult, false);
    expect(text).toContain('State file is valid');
    expect(text).toContain('Agent: demo-agent');
    expect(text).toContain('Format: v1');
    expect(text.trimStart().startsWith('{')).toBe(false);
  });

  it('includes component pagination metadata when requested', () => {
    const pagination: VerifyPagination = {
      offset: 1,
      limit: 1,
      total: 3,
      shown: 1,
      hasMore: true,
      nextOffset: 2,
    };
    const parsed = JSON.parse(
      formatVerifyResult({ ...validResult, components: ['memory/core.json'] }, true, pagination),
    ) as VerifyResult & { pagination: VerifyPagination };

    expect(parsed.components).toEqual(['memory/core.json']);
    expect(parsed.pagination).toEqual(pagination);
  });

  it('keeps existing exit codes', () => {
    expect(verifyExitCode('valid')).toBe(0);
    expect(verifyExitCode('wrong_password')).toBe(2);
    expect(verifyExitCode('corrupted')).toBe(1);
    expect(verifyExitCode('invalid_format')).toBe(1);
  });
});
