import { describe, expect, it } from 'vitest';
import { resources } from '../server.js';

describe('MCP resource metadata', () => {
  it('advertises snapshot date filters to clients', () => {
    const snapshots = resources.find((resource) => resource.uri === 'savestate://snapshots');

    expect(snapshots?.description).toContain('?since=');
    expect(snapshots?.description).toContain('?until=');
    expect(snapshots?.description).toContain('ISO-8601');
  });
});
