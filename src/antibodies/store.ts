/**
 * Failure Antibody JSON store (.savestate/antibodies.json)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { localConfigDir } from '../config.js';
import type { AntibodyRule, AntibodyStats, AntibodyStoreFile } from './types.js';

const ANTIBODIES_FILE = 'antibodies.json';

export interface ListRulesOptions {
  activeOnly?: boolean;
}

export class AntibodyStore {
  constructor(
    private readonly cwd?: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  path(): string {
    return join(localConfigDir(this.cwd), ANTIBODIES_FILE);
  }

  async load(): Promise<AntibodyStoreFile> {
    const path = this.path();
    if (!existsSync(path)) {
      return { version: 1, rules: [] };
    }

    try {
      const raw = await readFile(path, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AntibodyStoreFile>;
      return this.normalizeStoreFile(parsed);
    } catch {
      return { version: 1, rules: [] };
    }
  }

  async save(file: AntibodyStoreFile): Promise<void> {
    const dir = localConfigDir(this.cwd);
    await mkdir(dir, { recursive: true });
    const path = this.path();
    await writeFile(path, JSON.stringify(file, null, 2) + '\n', 'utf-8');
  }

  async list(options?: ListRulesOptions): Promise<AntibodyRule[]> {
    const file = await this.load();
    const rules = options?.activeOnly
      ? file.rules.filter((rule) => !rule.retired_at)
      : file.rules;

    return [...rules].sort((a, b) => a.id.localeCompare(b.id));
  }

  async add(rule: AntibodyRule): Promise<AntibodyRule> {
    const file = await this.load();
    const normalizedRule = this.normalizeRule(rule);
    const existing = file.rules.find((candidate) => candidate.id === normalizedRule.id);

    if (existing) {
      return existing;
    }

    file.rules.push(normalizedRule);
    await this.save(file);
    return normalizedRule;
  }

  async retire(ruleId: string): Promise<boolean> {
    const file = await this.load();
    const rule = file.rules.find((candidate) => candidate.id === ruleId);

    if (!rule || rule.retired_at) {
      return false;
    }

    rule.retired_at = this.now().toISOString();
    await this.save(file);
    return true;
  }

  async recordHit(ruleId: string): Promise<boolean> {
    return this.bumpCounter(ruleId, 'hits');
  }

  async recordOverride(ruleId: string): Promise<boolean> {
    return this.bumpCounter(ruleId, 'overrides');
  }

  async stats(): Promise<AntibodyStats> {
    const file = await this.load();
    const totalRules = file.rules.length;
    const activeRules = file.rules.filter((rule) => !rule.retired_at).length;
    const retiredRules = totalRules - activeRules;
    const totalHits = file.rules.reduce((sum, rule) => sum + rule.hits, 0);
    const totalOverrides = file.rules.reduce((sum, rule) => sum + rule.overrides, 0);

    return {
      total_rules: totalRules,
      active_rules: activeRules,
      retired_rules: retiredRules,
      total_hits: totalHits,
      total_overrides: totalOverrides,
      rules: file.rules.map((rule) => ({
        id: rule.id,
        risk: rule.risk,
        intervention: rule.intervention,
        active: !rule.retired_at,
        confidence: rule.confidence,
        hits: rule.hits,
        overrides: rule.overrides,
      })),
    };
  }

  private normalizeStoreFile(raw: Partial<AntibodyStoreFile>): AntibodyStoreFile {
    const rules = Array.isArray(raw.rules) ? raw.rules : [];
    return {
      version: 1,
      rules: rules.map((rule) => this.normalizeRule(rule as AntibodyRule)),
    };
  }

  private normalizeRule(rule: AntibodyRule): AntibodyRule {
    return {
      ...rule,
      created_at: rule.created_at || this.now().toISOString(),
      source_event_ids: Array.isArray(rule.source_event_ids) ? rule.source_event_ids : [],
      hits: Number.isFinite(rule.hits) ? rule.hits : 0,
      overrides: Number.isFinite(rule.overrides) ? rule.overrides : 0,
      trigger: {
        tool: rule.trigger?.tool,
        error_codes: rule.trigger?.error_codes?.slice(),
        path_prefixes: rule.trigger?.path_prefixes?.slice(),
        tags: rule.trigger?.tags?.slice(),
      },
      scope: {
        project: rule.scope?.project,
        adapters: rule.scope?.adapters?.slice(),
        tags: rule.scope?.tags?.slice(),
      },
    };
  }

  private async bumpCounter(ruleId: string, key: 'hits' | 'overrides'): Promise<boolean> {
    const file = await this.load();
    const rule = file.rules.find((candidate) => candidate.id === ruleId);

    if (!rule) {
      return false;
    }

    rule[key] += 1;
    await this.save(file);
    return true;
  }
}

