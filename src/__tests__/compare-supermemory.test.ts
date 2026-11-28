import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const site = join(__dirname, '..', '..', 'site');
const read = (p: string) => readFileSync(join(site, p), 'utf8');

describe('compare/vs-supermemory', () => {
  const page = read('compare/vs-supermemory.html');

  it('has a self canonical and keeps the competitor source', () => {
    expect(page).toContain('<link rel="canonical" href="https://savestate.dev/compare/vs-supermemory">');
    expect(page).toContain('https://supermemory.ai/pricing');
  });

  it('quotes SaveState prices that match the pricing page', () => {
    const pricing = read('pricing.html');
    expect(pricing).toContain('$9');
    expect(pricing).toContain('$29');
    expect(page).toContain('Pro $9 per month, Team $29 per month');
  });

  it('is in the sitemap and llms.txt', () => {
    expect(read('sitemap.xml')).toContain('https://savestate.dev/compare/vs-supermemory');
    expect(read('llms.txt')).toContain('https://savestate.dev/compare/vs-supermemory');
  });
});

describe('canonicals match cleanUrls', () => {
  it('no page canonicalizes to an .html twin', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(site, dir), { withFileTypes: true })) {
        const rel = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (['node_modules'].includes(entry.name)) continue;
          walk(rel);
        } else if (entry.name.endsWith('.html')) {
          const m = read(rel).match(/<link rel="canonical" href="([^"]+)"/);
          if (m && m[1].endsWith('.html')) offenders.push(`${rel} -> ${m[1]}`);
        }
      }
    };
    walk('');
    expect(offenders).toEqual([]);
  });
});
