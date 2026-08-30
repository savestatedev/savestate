/**
 * Lazy Stripe client. Module import must not throw when STRIPE_SECRET_KEY
 * is unset (unit tests import handlers without secrets).
 */

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    _stripe = new Stripe(key, {
      apiVersion: '2025-12-15.clover',
    });
  }
  return _stripe;
}

/** Test-only hook. */
export function setStripeForTests(client: Stripe | null): void {
  _stripe = client;
}
