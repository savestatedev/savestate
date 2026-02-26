/**
 * Tests for deny-list policy engine
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateDenyList,
  applyDenyList,
  createPolicy,
  addRule,
  removeRule,
  getBuiltinRuleSets,
  getBuiltinRules,
} from '../deny-list.js';

describe('Deny-List Policy Engine', () => {
  describe('createPolicy', () => {
    it('creates a policy with defaults', () => {
      const policy = createPolicy('test-policy');
      expect(policy.name).toBe('test-policy');
      expect(policy.enabled).toBe(true);
      expect(policy.defaultAction).toBe('allow');
      expect(policy.includes).toContain('pii-standard');
      expect(policy.includes).toContain('secrets');
    });

    it('respects custom options', () => {
      const policy = createPolicy('strict', {
        defaultAction: 'deny',
        includes: ['secrets'],
      });
      expect(policy.defaultAction).toBe('deny');
      expect(policy.includes).toEqual(['secrets']);
    });
  });

  describe('addRule / removeRule', () => {
    it('adds a rule to policy', () => {
      let policy = createPolicy('test');
      policy = addRule(policy, {
        name: 'Block internal IPs',
        type: 'regex',
        pattern: '10\\.\\d+\\.\\d+\\.\\d+',
        action: 'block',
      });
      expect(policy.rules).toHaveLength(1);
      expect(policy.rules[0].name).toBe('Block internal IPs');
      expect(policy.rules[0].id).toBeDefined();
    });

    it('removes a rule from policy', () => {
      let policy = createPolicy('test');
      policy = addRule(policy, {
        id: 'test-rule',
        name: 'Test Rule',
        type: 'exact',
        pattern: 'secret',
        action: 'block',
      });
      expect(policy.rules).toHaveLength(1);

      policy = removeRule(policy, 'test-rule');
      expect(policy.rules).toHaveLength(0);
    });
  });

  describe('evaluateDenyList', () => {
    it('matches exact patterns', () => {
      const policy = createPolicy('test', { includes: [] });
      const policyWithRule = addRule(policy, {
        name: 'Block secret word',
        type: 'exact',
        pattern: 'secret',
        action: 'block',
      });

      const result = evaluateDenyList('secret', policyWithRule);
      expect(result.matched).toBe(true);
      expect(result.action).toBe('block');
    });

    it('matches prefix patterns', () => {
      const policy = createPolicy('test', { includes: [] });
      const policyWithRule = addRule(policy, {
        name: 'Block AWS keys',
        type: 'prefix',
        pattern: 'AKIA',
        action: 'block',
      });

      const result = evaluateDenyList('AKIAIOSFODNN7EXAMPLE', policyWithRule);
      expect(result.matched).toBe(true);
    });

    it('matches suffix patterns', () => {
      const policy = createPolicy('test', { includes: [] });
      const policyWithRule = addRule(policy, {
        name: 'Block .env files',
        type: 'suffix',
        pattern: '.env',
        action: 'block',
      });

      const result = evaluateDenyList('config.env', policyWithRule);
      expect(result.matched).toBe(true);
    });

    it('matches contains patterns', () => {
      const policy = createPolicy('test', { includes: [] });
      const policyWithRule = addRule(policy, {
        name: 'Block password mentions',
        type: 'contains',
        pattern: 'password',
        action: 'redact',
      });

      const result = evaluateDenyList('user password=secret', policyWithRule);
      expect(result.matched).toBe(true);
      expect(result.matchedRules[0].matches[0].content).toBe('password');
    });

    it('matches regex patterns', () => {
      const policy = createPolicy('test', { includes: [] });
      const policyWithRule = addRule(policy, {
        name: 'Block SSN',
        type: 'regex',
        pattern: '\\d{3}-\\d{2}-\\d{4}',
        action: 'redact',
      });

      const result = evaluateDenyList('SSN: 123-45-6789', policyWithRule);
      expect(result.matched).toBe(true);
    });

    it('respects case sensitivity', () => {
      const policy = createPolicy('test', { includes: [] });
      const policyWithRule = addRule(policy, {
        name: 'Block SECRET (case-sensitive)',
        type: 'contains',
        pattern: 'SECRET',
        caseSensitive: true,
        action: 'block',
      });

      expect(evaluateDenyList('SECRET', policyWithRule).matched).toBe(true);
      expect(evaluateDenyList('secret', policyWithRule).matched).toBe(false);
    });

    it('uses highest priority rule action', () => {
      let policy = createPolicy('test', { includes: [] });
      policy = addRule(policy, {
        name: 'Warn about passwords',
        type: 'contains',
        pattern: 'password',
        action: 'warn',
        priority: 10,
      });
      policy = addRule(policy, {
        name: 'Block password leaks',
        type: 'contains',
        pattern: 'password=',
        action: 'block',
        priority: 100,
      });

      const result = evaluateDenyList('password=secret', policy);
      expect(result.action).toBe('block'); // Higher priority wins
    });

    it('skips disabled rules', () => {
      let policy = createPolicy('test', { includes: [] });
      policy = addRule(policy, {
        name: 'Disabled rule',
        type: 'exact',
        pattern: 'test',
        action: 'block',
        enabled: false,
      });

      expect(evaluateDenyList('test', policy).matched).toBe(false);
    });

    it('skips expired rules', () => {
      let policy = createPolicy('test', { includes: [] });
      policy = addRule(policy, {
        name: 'Expired rule',
        type: 'exact',
        pattern: 'test',
        action: 'block',
        expiresAt: '2020-01-01T00:00:00Z', // Expired
      });

      expect(evaluateDenyList('test', policy).matched).toBe(false);
    });

    it('uses default action when no matches', () => {
      const allowPolicy = createPolicy('allow', { includes: [], defaultAction: 'allow' });
      const denyPolicy = createPolicy('deny', { includes: [], defaultAction: 'deny' });

      expect(evaluateDenyList('clean content', allowPolicy).action).toBe('allow');
      expect(evaluateDenyList('clean content', denyPolicy).action).toBe('block');
    });
  });

  describe('applyDenyList', () => {
    it('redacts matched content', () => {
      let policy = createPolicy('test', { includes: [] });
      policy = addRule(policy, {
        name: 'Redact SSN',
        type: 'regex',
        pattern: '\\d{3}-\\d{2}-\\d{4}',
        action: 'redact',
      });

      const { content, evaluation } = applyDenyList('SSN: 123-45-6789', policy);
      expect(content).toBe('SSN: [DENIED:Redact SSN]');
      expect(evaluation.matched).toBe(true);
    });

    it('handles multiple redactions', () => {
      let policy = createPolicy('test', { includes: [] });
      policy = addRule(policy, {
        name: 'Redact numbers',
        type: 'regex',
        pattern: '\\d{3}-\\d{2}-\\d{4}',
        action: 'redact',
      });

      const { content } = applyDenyList('A: 123-45-6789, B: 987-65-4321', policy);
      expect(content).toContain('[DENIED:');
      expect((content.match(/\[DENIED:/g) || []).length).toBe(2);
    });

    it('does not modify for non-redact actions', () => {
      let policy = createPolicy('test', { includes: [] });
      policy = addRule(policy, {
        name: 'Audit only',
        type: 'contains',
        pattern: 'secret',
        action: 'audit',
      });

      const { content, evaluation } = applyDenyList('my secret data', policy);
      expect(content).toBe('my secret data');
      expect(evaluation.matched).toBe(true);
      expect(evaluation.action).toBe('audit');
    });
  });

  describe('Built-in Rule Sets', () => {
    it('lists available rule sets', () => {
      const sets = getBuiltinRuleSets();
      expect(sets).toContain('pii-standard');
      expect(sets).toContain('secrets');
      expect(sets).toContain('financial');
      expect(sets).toContain('health');
    });

    it('retrieves built-in rules', () => {
      const secretsRules = getBuiltinRules('secrets');
      expect(secretsRules.length).toBeGreaterThan(0);
      expect(secretsRules.some(r => r.id === 'secret-aws-key')).toBe(true);
    });

    it('includes built-in rules when evaluating', () => {
      const policy = createPolicy('with-builtins', { includes: ['secrets'] });

      // AWS key should be blocked by built-in secrets rules
      const result = evaluateDenyList('Key: AKIAIOSFODNN7EXAMPLE', policy);
      expect(result.matched).toBe(true);
      expect(result.action).toBe('block');
    });

    it('detects private keys via contains', () => {
      const policy = createPolicy('with-secrets', { includes: ['secrets'] });
      const result = evaluateDenyList('-----BEGIN RSA PRIVATE KEY-----', policy);
      expect(result.matched).toBe(true);
      expect(result.action).toBe('block');
    });
  });
});
