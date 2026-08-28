/**
 * Sales-lock marketing: public blog/FAQ CTAs must resolve to live Payment Links.
 * Prices and URLs come from stripe-config.json — do not invent them.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface StripeProduct {
  amount_cents: number;
  payment_link: string;
}

interface StripeConfig {
  products: {
    pro: StripeProduct;
    team: StripeProduct;
  };
}

function loadStripeConfig(): StripeConfig {
  return JSON.parse(readFileSync(join(root, 'stripe-config.json'), 'utf8')) as StripeConfig;
}

function loadHtml(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function hrefForCta(html: string, cta: string): string {
  const match = html.match(new RegExp(`href="([^"]+)"[^>]*data-cta="${cta}"|data-cta="${cta}"[^>]*href="([^"]+)"`));
  const href = match?.[1] ?? match?.[2];
  if (!href) {
    throw new Error(`Missing data-cta="${cta}"`);
  }
  return href;
}

function hasOg(html: string, property: string): boolean {
  return new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="[^"]+"`, 'i').test(html)
    || new RegExp(`<meta[^>]+content="[^"]+"[^>]+(?:property|name)="${property}"`, 'i').test(html);
}

describe('public marketing checkout CTAs', () => {
  const stripe = loadStripeConfig();
  const post = loadHtml('site/blog/when-the-chat-dies.html');
  const faq = loadHtml('site/faq.html');
  const blogIndex = loadHtml('site/blog/index.html');
  const homepage = loadHtml('site/index.html');
  const sitemap = loadHtml('site/sitemap.xml');

  it('uses the configured Pro and Team payment links (no invented prices)', () => {
    expect(stripe.products.pro.amount_cents).toBe(900);
    expect(stripe.products.team.amount_cents).toBe(2900);
    expect(stripe.products.pro.payment_link).toMatch(/^https:\/\/buy\.stripe\.com\//);
    expect(stripe.products.team.payment_link).toMatch(/^https:\/\/buy\.stripe\.com\//);
  });

  it('points the buyer post CTAs at the live Payment Links', () => {
    expect(hrefForCta(post, 'blog-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(post, 'blog-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(post, 'blog-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(post, 'blog-team-checkout')).toBe(stripe.products.team.payment_link);
  });

  it('keeps npm as a secondary path on the buyer post, never the primary CTA', () => {
    expect(hrefForCta(post, 'blog-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(post).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(post, 'blog-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points FAQ primary CTAs at the live Payment Links', () => {
    expect(hrefForCta(faq, 'faq-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(faq, 'faq-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(faq, 'faq-inline-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(faq, 'faq-inline-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(faq, 'faq-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
  });

  it('points blog index primary CTAs at the live Pro Payment Link', () => {
    expect(hrefForCta(blogIndex, 'blog-index-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(blogIndex, 'blog-index-sidebar-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(blogIndex, 'blog-index-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
  });

  it('does not keep a waitlist on the marketing pages', () => {
    for (const html of [post, faq, blogIndex, homepage]) {
      expect(html).not.toMatch(/Join Waitlist/i);
      expect(html).not.toMatch(/waitlist for Pro features/i);
      expect(html).not.toMatch(/id="lead-form"/);
    }
  });

  it('ships SEO, Open Graph, and Twitter meta on the public surfaces', () => {
    for (const html of [post, faq, blogIndex, homepage]) {
      expect(hasOg(html, 'og:title')).toBe(true);
      expect(hasOg(html, 'og:description')).toBe(true);
      expect(hasOg(html, 'og:image')).toBe(true);
      expect(hasOg(html, 'twitter:card')).toBe(true);
      expect(hasOg(html, 'twitter:title')).toBe(true);
    }
    expect(homepage).toMatch(/When the chat dies, your agent still knows/);
    expect(post).toMatch(/Claude Code/);
    expect(post).toMatch(/Cursor/);
    expect(post).toMatch(/Clawdbot/);
  });

  it('lists the buyer post on the live URL path after merge', () => {
    expect(sitemap).toContain('https://savestate.dev/blog/when-the-chat-dies');
    expect(blogIndex).toContain('/blog/when-the-chat-dies');
    expect(blogIndex).toContain('When the Chat Dies, Your Agent Still Knows');
  });
});
