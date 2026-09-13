import { describe, expect, it } from 'vitest';
import { parseAclType } from '../acl.js';

describe('savestate acl propose --type', () => {
  it('accepts known commitment types', () => {
    expect(parseAclType('customer_promise')).toBe('customer_promise');
    expect(parseAclType('ticket_status_change')).toBe('ticket_status_change');
    expect(parseAclType('ESCALATION_CLOSURE')).toBe('escalation_closure');
    expect(parseAclType(' account_tool_write ')).toBe('account_tool_write');
  });

  it.each(['', ' ', 'nope', 'refund', '1', 'promise'])('rejects invalid value %s', (value) => {
    expect(() => parseAclType(value)).toThrow(
      `Invalid --type value "${value}". Expected one of: customer_promise, ticket_status_change, escalation_closure, account_tool_write.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseAclType(undefined)).toThrow(
      'Invalid --type value. Expected one of: customer_promise, ticket_status_change, escalation_closure, account_tool_write.',
    );
  });
});
