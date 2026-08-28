/**
 * Sales-lock tests: a stranger on the homepage must reach live Stripe checkout.
 * Payment links and prices come from stripe-config.json — do not invent them.
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

describe('homepage checkout CTAs', () => {
  const stripe = loadStripeConfig();
  const homepage = loadHtml('site/index.html');
  const dashboard = loadHtml('site/dashboard.html');

  it('uses the configured Pro and Team payment links (no invented prices)', () => {
    expect(stripe.products.pro.amount_cents).toBe(900);
    expect(stripe.products.team.amount_cents).toBe(2900);
    expect(stripe.products.pro.payment_link).toMatch(/^https:\/\/buy\.stripe\.com\//);
    expect(stripe.products.team.payment_link).toMatch(/^https:\/\/buy\.stripe\.com\//);
  });

  it('points the hero CTA at the live Pro Payment Link', () => {
    expect(hrefForCta(homepage, 'hero-checkout')).toBe(stripe.products.pro.payment_link);
  });

  it('points the hero Team CTA at the live Team Payment Link', () => {
    expect(hrefForCta(homepage, 'hero-team-checkout')).toBe(stripe.products.team.payment_link);
  });

  it('points Pro and Team plan CTAs at the live Payment Links', () => {
    expect(hrefForCta(homepage, 'pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(homepage, 'team-checkout')).toBe(stripe.products.team.payment_link);
  });

  it('points the homepage nav subscribe CTA at the live Pro Payment Link', () => {
    expect(hrefForCta(homepage, 'nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
  });

  it('points the Get Started footer CTAs at the live Payment Links', () => {
    expect(hrefForCta(homepage, 'footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(homepage, 'footer-team-checkout')).toBe(stripe.products.team.payment_link);
  });

  it('tells a paying stranger how fulfillment works after checkout', () => {
    expect(homepage).toMatch(/After you pay, your API key is emailed/);
    expect(homepage).toMatch(/savestate login/);
  });

  it('does not keep a Pro waitlist on the homepage', () => {
    expect(homepage).not.toMatch(/waitlist for Pro features/i);
    expect(homepage).not.toMatch(/Join Waitlist/i);
    expect(homepage).not.toMatch(/id="lead-form"/);
    expect(homepage).not.toMatch(/id="early-access"/);
    expect(homepage).not.toMatch(/\/api\/lead/);
  });

  it('points dashboard subscribe CTAs at the live Payment Links', () => {
    expect(hrefForCta(dashboard, 'dashboard-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(dashboard, 'dashboard-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(dashboard).not.toMatch(/href="\/#pricing"[^>]*>\s*Subscribe/);
    expect(dashboard).toMatch(/After you pay, your API key is emailed/);
    expect(dashboard).toMatch(/savestate login/);
  });

  it('reaches live Stripe checkout for hero and plan Payment Links', async () => {
    const links = [
      hrefForCta(homepage, 'hero-checkout'),
      hrefForCta(homepage, 'hero-team-checkout'),
      hrefForCta(homepage, 'pro-checkout'),
      hrefForCta(homepage, 'team-checkout'),
    ];

    for (const url of links) {
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      expect(response.ok, `${url} returned ${response.status}`).toBe(true);
      expect(new URL(response.url).hostname).toMatch(/stripe\.com$/);
    }
  });
});
