/**
 * GET /v1/keys/claims/:id
 *
 * unpaid      → 402  { pay_url, claim_url }
 * processing  → 202  (paid; webhook has not issued yet)
 * issued      → 200  { api_key } exactly once
 * claimed     → 409
 * expired     → 410
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { consumeKeyClaim, getKeyClaim, initDb } from '../../../lib/db.js';
import {
  claimUrl,
  paymentRequiredBody,
  publicBaseUrl,
  setCors,
} from '../../../lib/http.js';
import { getStripe } from '../../../lib/stripe-client.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const claimId = String(req.query.id ?? '').trim();
  if (!isUuid(claimId)) {
    return res.status(404).json({ error: 'claim_not_found' });
  }

  try {
    await initDb();
  } catch (err) {
    console.error('GET /v1/keys/claims initDb failed:', err instanceof Error ? err.message : err);
    return res.status(503).json({ error: 'Claim store unavailable' });
  }

  const claim = await getKeyClaim(claimId);
  if (!claim) {
    return res.status(404).json({ error: 'claim_not_found' });
  }

  const base = publicBaseUrl(req);
  const self = claimUrl(base, claim.id);
  const expired = new Date(claim.expires_at).getTime() < Date.now();

  if (expired && claim.status !== 'claimed') {
    return res.status(410).json({ error: 'claim_expired' });
  }

  if (claim.status === 'claimed') {
    return res.status(409).json({ error: 'already_claimed' });
  }

  if (claim.status === 'expired') {
    return res.status(410).json({ error: 'claim_expired' });
  }

  if (claim.status === 'issued') {
    const apiKey = await consumeKeyClaim(claim.id);
    if (!apiKey) {
      return res.status(409).json({ error: 'already_claimed' });
    }
    return res.status(200).json({
      api_key: apiKey,
      claimed: true,
    });
  }

  if (claim.status === 'processing') {
    return res.status(202).json({
      status: 'processing',
      claim_url: self,
    });
  }

  // unpaid — if Stripe already marked the session paid, wait for the webhook.
  const paidOnStripe = await sessionLooksPaid(claim.stripe_session_id);
  if (paidOnStripe) {
    return res.status(202).json({
      status: 'processing',
      claim_url: self,
    });
  }

  return res.status(402).json(
    paymentRequiredBody({
      pay_url: claim.stripe_session_url,
      claim_url: self,
    }),
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function sessionLooksPaid(sessionId: string): Promise<boolean> {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    return session.payment_status === 'paid' || session.status === 'complete';
  } catch {
    return false;
  }
}
