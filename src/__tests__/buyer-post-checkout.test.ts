/**
 * Sales-lock test: the Week 1 buyer post must send the primary CTA
 * to the live Pro Payment Link from stripe-config.json.
 * Do not invent prices or Stripe URLs.
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

describe('buyer post checkout CTA', () => {
  const stripe = loadStripeConfig();
  const page = loadHtml('site/blog/memory-survives-the-chat.html');

  it('points the primary CTA at the live Pro Payment Link', () => {
    expect(hrefForCta(page, 'buyer-post-pro-checkout')).toBe(stripe.products.pro.payment_link);
  });
});
