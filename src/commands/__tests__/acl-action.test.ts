import { describe, expect, it } from 'vitest';
import { parseAclAction } from '../acl.js';

describe('savestate acl gate --action', () => {
  it('accepts known commitment types', () => {
    expect(parseAclAction('customer_promise')).toBe('customer_promise');
    expect(parseAclAction('ticket_status_change')).toBe('ticket_status_change');
    expect(parseAclAction('ESCALATION_CLOSURE')).toBe('escalation_closure');
    expect(parseAclAction(' account_tool_write ')).toBe('account_tool_write');
  });

  it.each(['', ' ', 'nope', 'refund', '1', 'promise'])('rejects invalid value %s', (value) => {
    expect(() => parseAclAction(value)).toThrow(
      `Invalid --action value "${value}". Expected one of: customer_promise, ticket_status_change, escalation_closure, account_tool_write.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseAclAction(undefined)).toThrow(
      'Invalid --action value. Expected one of: customer_promise, ticket_status_change, escalation_closure, account_tool_write.',
    );
  });
});
