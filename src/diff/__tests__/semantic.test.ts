import { describe, expect, it } from 'vitest';
import { diffIdentity, formatIdentityDiff } from '../semantic.js';
import type { AgentIdentity } from '../../identity/schema.js';

describe('diffIdentity', () => {
  const baseIdentity: AgentIdentity = {
    schemaVersion: '1.0.0',
    name: 'TestAgent',
    version: '1.0.0',
    goals: ['Help users'],
    tone: 'friendly',
    constraints: ['Be helpful'],
    tools: [{ name: 'calculator', enabled: true }],
    metadata: {},
  };

  it('returns no changes for identical identities', () => {
    const diff = diffIdentity(baseIdentity, { ...baseIdentity });
    expect(diff.hasChanges).toBe(false);
    expect(diff.changes).toHaveLength(0);
  });

  it('detects added fields', () => {
    const after: AgentIdentity = {
      ...baseIdentity,
      persona: 'A helpful assistant',
    };
    const diff = diffIdentity(baseIdentity, after);

    expect(diff.hasChanges).toBe(true);
    const addedChanges = diff.changes.filter((c) => c.type === 'added');
    expect(addedChanges.length).toBeGreaterThan(0);
    expect(diff.summary.added).toBeGreaterThan(0);
  });

  it('detects removed fields', () => {
    const after: AgentIdentity = {
      ...baseIdentity,
      tone: undefined,
    };
    const diff = diffIdentity(baseIdentity, after);

    expect(diff.hasChanges).toBe(true);
    const removedChanges = diff.changes.filter((c) => c.type === 'removed');
    expect(removedChanges.length).toBeGreaterThan(0);
    expect(diff.summary.removed).toBeGreaterThan(0);
  });

  it('detects modified fields', () => {
    const after: AgentIdentity = {
      ...baseIdentity,
      tone: 'professional',
    };
    const diff = diffIdentity(baseIdentity, after);

    expect(diff.hasChanges).toBe(true);
    const modifiedChanges = diff.changes.filter((c) => c.type === 'modified');
    expect(modifiedChanges.length).toBeGreaterThan(0);
    expect(diff.summary.modified).toBeGreaterThan(0);
  });

  it('detects added goals', () => {
    const after: AgentIdentity = {
      ...baseIdentity,
      goals: ['Help users', 'Be efficient'],
    };
    const diff = diffIdentity(baseIdentity, after);

    expect(diff.hasChanges).toBe(true);
    // Check that there's an added change for the new goal
    const goalChanges = diff.changes.filter((c) => c.path === 'goals');
    expect(goalChanges.some((c) => c.type === 'added' && c.after === 'Be efficient')).toBe(true);
  });

  it('detects removed constraints', () => {
    const after: AgentIdentity = {
      ...baseIdentity,
      constraints: [],
    };
    const diff = diffIdentity(baseIdentity, after);

    expect(diff.hasChanges).toBe(true);
    // Check that there's a removed change for the constraint
    const constraintChanges = diff.changes.filter((c) => c.path === 'constraints');
    expect(constraintChanges.some((c) => c.type === 'removed' && c.before === 'Be helpful')).toBe(true);
  });

  it('detects tool changes', () => {
    const after: AgentIdentity = {
      ...baseIdentity,
      tools: [
        { name: 'calculator', enabled: false }, // Modified
        { name: 'web_search', enabled: true }, // Added
      ],
    };
    const diff = diffIdentity(baseIdentity, after);

    expect(diff.hasChanges).toBe(true);
    const toolChanges = diff.changes.filter((c) => c.field === 'tools');
    expect(toolChanges.length).toBeGreaterThanOrEqual(2);
  });

  it('detects version changes', () => {
    const after: AgentIdentity = {
      ...baseIdentity,
      version: '2.0.0',
    };
    const diff = diffIdentity(baseIdentity, after);

    expect(diff.versionChange).toEqual({
      before: '1.0.0',
      after: '2.0.0',
    });
  });

  it('handles undefined before (new identity)', () => {
    const diff = diffIdentity(undefined, baseIdentity);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.added).toBeGreaterThan(0);
  });

  it('handles undefined after (removed identity)', () => {
    const diff = diffIdentity(baseIdentity, undefined);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.removed).toBeGreaterThan(0);
  });

  it('handles both undefined', () => {
    const diff = diffIdentity(undefined, undefined);

    expect(diff.hasChanges).toBe(false);
    expect(diff.changes).toHaveLength(0);
  });

  it('detects metadata changes', () => {
    const after: AgentIdentity = {
      ...baseIdentity,
      metadata: { customKey: 'customValue' },
    };
    const diff = diffIdentity(baseIdentity, after);

    expect(diff.hasChanges).toBe(true);
    const metadataChanges = diff.changes.filter((c) =>
      c.path.startsWith('metadata'),
    );
    expect(metadataChanges.length).toBeGreaterThan(0);
  });

  it('produces stable output regardless of key ordering', () => {
    const identity1: AgentIdentity = {
      name: 'Test',
      version: '1.0.0',
      goals: ['A', 'B'],
      schemaVersion: '1.0.0',
      metadata: {},
      constraints: [],
      tools: [],
    };

    const identity2: AgentIdentity = {
      schemaVersion: '1.0.0',
      tools: [],
      constraints: [],
      metadata: {},
      goals: ['A', 'B'],
      version: '1.0.0',
      name: 'Test',
    };

    const diff1 = diffIdentity(baseIdentity, identity1);
    const diff2 = diffIdentity(baseIdentity, identity2);

    // Both diffs should have the same content
    expect(diff1.summary).toEqual(diff2.summary);
  });
});

describe('formatIdentityDiff', () => {
  it('formats no changes message', () => {
    const diff = diffIdentity(
      { name: 'Test', schemaVersion: '1.0.0', version: '1.0.0', goals: [], constraints: [], tools: [], metadata: {} },
      { name: 'Test', schemaVersion: '1.0.0', version: '1.0.0', goals: [], constraints: [], tools: [], metadata: {} },
    );
    const output = formatIdentityDiff(diff);
    expect(output).toContain('No changes');
  });

  it('formats changes with symbols', () => {
    const before: AgentIdentity = {
      name: 'Test',
      schemaVersion: '1.0.0',
      version: '1.0.0',
      goals: [],
      constraints: [],
      tools: [],
      metadata: {},
    };
    const after: AgentIdentity = {
      ...before,
      tone: 'friendly',
      goals: ['New goal'],
    };
    const diff = diffIdentity(before, after);
    const output = formatIdentityDiff(diff);

    expect(output).toContain('Agent Identity Changes');
    expect(output).toContain('+');
  });
});
