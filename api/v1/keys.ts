/**
 * POST /v1/keys
 *
 * Agent self-serve. Empty body is fine. Creates a Stripe Checkout Session
 * with price_data (Pro $9/mo) and returns HTTP 402 with pay_url + claim_url.
 * The secret is minted only by the signed checkout.session.completed webhook.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { createProCheckoutSession } from '../lib/create-pro-session.js';
import { initDb, createKeyClaim } from '../lib/db.js';
import {
  claimUrl,
  parseJsonBody,
  paymentRequiredBody,
  publicBaseUrl,
  setCors,
} from '../lib/http.js';
import { CLAIM_TTL_MS } from '../lib/pro-checkout.js';
import { getStripe } from '../lib/stripe-client.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseJsonBody(req);
  const email =
    typeof body.email === 'string' && body.email.includes('@')
      ? body.email
      : undefined;

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return res.status(503).json({ error: 'Checkout is not configured' });
  }

  const claimId = randomUUID();
  const base = publicBaseUrl(req);
  const claim = claimUrl(base, claimId);
  const successUrl = `${claim}?session_id={CHECKOUT_SESSION_ID}`;

  try {
    await initDb();

    const session = await createProCheckoutSession({
      stripe,
      claimId,
      successUrl,
      cancelUrl: claim,
      customerEmail: email,
    });

    if (!session.id || !session.url) {
      return res.status(503).json({ error: 'Checkout session missing url' });
    }

    await createKeyClaim({
      id: claimId,
      stripeSessionId: session.id,
      stripeSessionUrl: session.url,
      expiresAt: new Date(Date.now() + CLAIM_TTL_MS),
    });

    return res.status(402).json(
      paymentRequiredBody({
        pay_url: session.url,
        claim_url: claim,
      }),
    );
  } catch (err) {
    console.error('POST /v1/keys failed:', err instanceof Error ? err.message : err);
    return res.status(503).json({ error: 'Failed to start checkout' });
  }
}
