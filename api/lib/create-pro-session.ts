/**
 * Create a Stripe Checkout Session for SaveState Pro using price_data.
 * Do not pass a Stripe price_ ID — the live $9/mo amount is inlined.
 */

import type Stripe from 'stripe';
import {
  PRO_CURRENCY,
  PRO_INTERVAL,
  PRO_PRODUCT_DESCRIPTION,
  PRO_PRODUCT_NAME,
  PRO_UNIT_AMOUNT,
} from './pro-checkout.js';

export async function createProCheckoutSession(params: {
  stripe: Stripe;
  claimId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}): Promise<Stripe.Checkout.Session> {
  return params.stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PRO_CURRENCY,
          unit_amount: PRO_UNIT_AMOUNT,
          recurring: { interval: PRO_INTERVAL },
          product_data: {
            name: PRO_PRODUCT_NAME,
            description: PRO_PRODUCT_DESCRIPTION,
          },
        },
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
    metadata: {
      claim_id: params.claimId,
      source: 'agent_v1_keys',
      product: 'pro',
    },
    subscription_data: {
      metadata: {
        claim_id: params.claimId,
        source: 'agent_v1_keys',
        product: 'pro',
      },
    },
  });
}
