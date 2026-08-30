/**
 * Agent key issuance: POST /v1/keys → 402, webhook mints, claim once.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import type { KeyClaim } from '../../api/lib/db.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const claimId = '11111111-1111-4111-8111-111111111111';
const sessionUrl = 'https://checkout.stripe.com/c/pay/cs_test_agent';

const db = vi.hoisted(() => {
  const store: { claim: KeyClaim | null; processed: Set<string>; accounts: number } = {
    claim: null,
    processed: new Set(),
    accounts: 0,
  };
  return { store };
});

const stripeState = vi.hoisted(() => ({
  retrieve: { payment_status: 'unpaid', status: 'open' } as {
    payment_status: string;
    status: string;
  },
  created: [] as unknown[],
}));

vi.mock('../../api/lib/db.js', () => ({
  initDb: vi.fn(async () => undefined),
  createKeyClaim: vi.fn(async (params: {
    id: string;
    stripeSessionId: string;
    stripeSessionUrl: string;
    expiresAt: Date;
  }) => {
    db.store.claim = {
      id: params.id,
      stripe_session_id: params.stripeSessionId,
      stripe_session_url: params.stripeSessionUrl,
      status: 'unpaid',
      api_key: null,
      account_id: null,
      created_at: new Date().toISOString(),
      expires_at: params.expiresAt.toISOString(),
      claimed_at: null,
    };
    return db.store.claim;
  }),
  getKeyClaim: vi.fn(async (id: string) =>
    db.store.claim && db.store.claim.id === id ? db.store.claim : null,
  ),
  getKeyClaimBySessionId: vi.fn(async (sessionId: string) =>
    db.store.claim && db.store.claim.stripe_session_id === sessionId
      ? db.store.claim
      : null,
  ),
  markKeyClaimProcessing: vi.fn(async (sessionId: string) => {
    if (db.store.claim && db.store.claim.stripe_session_id === sessionId && db.store.claim.status === 'unpaid') {
      db.store.claim.status = 'processing';
    }
  }),
  issueKeyClaim: vi.fn(async (params: { sessionId: string; apiKey: string; accountId: string }) => {
    if (!db.store.claim) return null;
    if (db.store.claim.stripe_session_id !== params.sessionId) return null;
    if (db.store.claim.status !== 'unpaid' && db.store.claim.status !== 'processing') {
      return db.store.claim;
    }
    db.store.claim.status = 'issued';
    db.store.claim.api_key = params.apiKey;
    db.store.claim.account_id = params.accountId;
    return db.store.claim;
  }),
  consumeKeyClaim: vi.fn(async (id: string) => {
    if (!db.store.claim || db.store.claim.id !== id || db.store.claim.status !== 'issued') {
      return null;
    }
    const key = db.store.claim.api_key;
    db.store.claim.status = 'claimed';
    db.store.claim.claimed_at = new Date().toISOString();
    db.store.claim.api_key = null;
    return key;
  }),
  isCheckoutSessionProcessed: vi.fn(async (sessionId: string) => db.store.processed.has(sessionId)),
  markCheckoutSessionProcessed: vi.fn(async (sessionId: string) => {
    if (db.store.processed.has(sessionId)) return false;
    db.store.processed.add(sessionId);
    return true;
  }),
  createAccount: vi.fn(async (params: { tier: string; email: string }) => {
    db.store.accounts += 1;
    return {
      id: 'acct_1',
      email: params.email,
      name: null,
      api_key: 'ss_live_MINTEDSECRET',
      tier: params.tier,
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      stripe_status: 'active',
      storage_used_bytes: 0,
      storage_limit_bytes: 10 * 1024 * 1024 * 1024,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }),
  updateSubscriptionStatus: vi.fn(async () => undefined),
  getAccountByStripeCustomer: vi.fn(async () => null),
}));

vi.mock('../../api/lib/stripe-client.js', () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: async (params: unknown) => {
          stripeState.created.push(params);
          return { id: 'cs_test_agent', url: sessionUrl };
        },
        retrieve: async () => stripeState.retrieve,
      },
    },
    subscriptions: {
      retrieve: async () => ({
        items: { data: [{ price: { id: 'price_adhoc_from_price_data', unit_amount: 900 } }] },
      }),
    },
    webhooks: { constructEvent: () => ({}) },
  }),
  setStripeForTests: () => undefined,
}));

vi.mock('../../api/lib/email.js', () => ({
  sendEmail: vi.fn(async () => undefined),
  welcomeEmailHtml: () => '<p>key</p>',
}));

import keysHandler from '../../api/v1/keys.js';
import claimHandler from '../../api/v1/keys/claims/[id].js';
import { fulfillCheckoutSession } from '../../api/webhook.js';
import { createProCheckoutSession } from '../../api/lib/create-pro-session.js';
import { paymentRequiredBody } from '../../api/lib/http.js';
import { createAccount } from '../../api/lib/db.js';

function mockReq(partial: Partial<VercelRequest>): VercelRequest {
  return {
    method: 'POST',
    headers: { host: 'savestate.dev', 'x-forwarded-proto': 'https' },
    body: {},
    query: {},
    ...partial,
  } as VercelRequest;
}

function mockRes(): VercelResponse & { statusCode: number; body: unknown } {
  const out = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      out.headers[k] = v;
    },
    status(code: number) {
      out.statusCode = code;
      return out;
    },
    json(payload: unknown) {
      out.body = payload;
      return out;
    },
    end() {
      return out;
    },
  };
  return out as unknown as VercelResponse & { statusCode: number; body: unknown };
}

beforeEach(() => {
  db.store.claim = null;
  db.store.processed.clear();
  db.store.accounts = 0;
  stripeState.created.length = 0;
  stripeState.retrieve = { payment_status: 'unpaid', status: 'open' };
});

describe('createProCheckoutSession', () => {
  it('uses price_data at $9/mo and never a price_ ID', async () => {
    let captured: Stripe.Checkout.SessionCreateParams | undefined;
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            captured = params;
            return { id: 'cs_x', url: 'https://checkout.stripe.com/c/pay/cs_x' };
          },
        },
      },
    };

    await createProCheckoutSession({
      stripe: stripe as unknown as Stripe,
      claimId,
      successUrl: `https://savestate.dev/v1/keys/claims/${claimId}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `https://savestate.dev/v1/keys/claims/${claimId}`,
    });

    expect(captured?.mode).toBe('subscription');
    const item = captured?.line_items?.[0];
    expect(item?.price).toBeUndefined();
    expect(item?.price_data?.unit_amount).toBe(900);
    expect(item?.price_data?.recurring?.interval).toBe('month');
    expect(item?.price_data?.product_data?.name).toBe('SaveState Pro');
    expect(JSON.stringify(captured)).not.toMatch(/price_1/);
    expect(captured?.success_url).toContain('{CHECKOUT_SESSION_ID}');
    expect(captured?.metadata?.claim_id).toBe(claimId);
  });
});

describe('POST /v1/keys', () => {
  it('accepts empty {} and returns 402 with pay_url and claim_url', async () => {
    const res = mockRes();
    await keysHandler(mockReq({ method: 'POST', body: {} }), res);

    expect(res.statusCode).toBe(402);
    const body = res.body as { pay_url: string; claim_url: string };
    expect(body.pay_url).toBe(sessionUrl);
    expect(body.claim_url).toMatch(/^https:\/\/savestate\.dev\/v1\/keys\/claims\/[0-9a-f-]{36}$/);
    expect(body.pay_url).toBeTruthy();
    expect(body.claim_url).toBeTruthy();
    expect(stripeState.created[0] as { line_items: Array<{ price?: string }> }).toBeDefined();
    expect(JSON.stringify(stripeState.created[0])).not.toMatch(/price_1/);
    expect(JSON.stringify(stripeState.created[0])).toContain('"unit_amount":900');
  });

  it('does not invent a Stripe price_ ID in the handler source', () => {
    const src = readFileSync(join(root, 'api/v1/keys.ts'), 'utf8');
    expect(src).not.toMatch(/price_1/);
    expect(src).toContain('createProCheckoutSession');
  });
});

describe('GET /v1/keys/claims/:id', () => {
  function unpaidClaim(): KeyClaim {
    return {
      id: claimId,
      stripe_session_id: 'cs_test_agent',
      stripe_session_url: sessionUrl,
      status: 'unpaid',
      api_key: null,
      account_id: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      claimed_at: null,
    };
  }

  it('returns 402 with pay_url and claim_url while unpaid', async () => {
    db.store.claim = unpaidClaim();
    const res = mockRes();
    await claimHandler(
      mockReq({ method: 'GET', query: { id: claimId } }),
      res,
    );
    expect(res.statusCode).toBe(402);
    const body = res.body as { pay_url: string; claim_url: string };
    expect(body.pay_url).toBe(sessionUrl);
    expect(body.claim_url).toBe(`https://savestate.dev/v1/keys/claims/${claimId}`);
  });

  it('returns 202 when Stripe shows paid but the webhook has not issued', async () => {
    db.store.claim = unpaidClaim();
    stripeState.retrieve = { payment_status: 'paid', status: 'complete' };
    const res = mockRes();
    await claimHandler(mockReq({ method: 'GET', query: { id: claimId } }), res);
    expect(res.statusCode).toBe(202);
  });

  it('returns 202 while processing', async () => {
    db.store.claim = { ...unpaidClaim(), status: 'processing' };
    const res = mockRes();
    await claimHandler(mockReq({ method: 'GET', query: { id: claimId } }), res);
    expect(res.statusCode).toBe(202);
  });

  it('returns the api_key once on issued, then 409', async () => {
    db.store.claim = {
      ...unpaidClaim(),
      status: 'issued',
      api_key: 'ss_live_MINTEDSECRET',
    };

    const first = mockRes();
    await claimHandler(mockReq({ method: 'GET', query: { id: claimId } }), first);
    expect(first.statusCode).toBe(200);
    expect((first.body as { api_key: string }).api_key).toBe('ss_live_MINTEDSECRET');

    const second = mockRes();
    await claimHandler(mockReq({ method: 'GET', query: { id: claimId } }), second);
    expect(second.statusCode).toBe(409);
    expect(second.body as { error: string }).toEqual({ error: 'already_claimed' });
  });

  it('returns 410 when the claim is expired', async () => {
    db.store.claim = {
      ...unpaidClaim(),
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    const res = mockRes();
    await claimHandler(mockReq({ method: 'GET', query: { id: claimId } }), res);
    expect(res.statusCode).toBe(410);
  });
});

describe('fulfillCheckoutSession', () => {
  it('mints a real Pro secret and attaches it to the claim', async () => {
    db.store.claim = {
      id: claimId,
      stripe_session_id: 'cs_test_agent',
      stripe_session_url: sessionUrl,
      status: 'unpaid',
      api_key: null,
      account_id: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      claimed_at: null,
    };

    await fulfillCheckoutSession({
      id: 'cs_test_agent',
      customer: 'cus_1',
      subscription: 'sub_1',
      customer_email: 'agent@example.com',
      customer_details: { email: 'agent@example.com', name: 'Agent' },
      metadata: { claim_id: claimId, source: 'agent_v1_keys', product: 'pro' },
    } as unknown as Stripe.Checkout.Session);

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'pro', email: 'agent@example.com' }),
    );
    expect(db.store.claim?.status).toBe('issued');
    expect(db.store.claim?.api_key).toBe('ss_live_MINTEDSECRET');
    expect(db.store.accounts).toBe(1);
  });

  it('is idempotent on session.id and never mints Free', async () => {
    db.store.claim = {
      id: claimId,
      stripe_session_id: 'cs_test_agent',
      stripe_session_url: sessionUrl,
      status: 'unpaid',
      api_key: null,
      account_id: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      claimed_at: null,
    };

    const session = {
      id: 'cs_test_agent',
      customer: 'cus_1',
      subscription: 'sub_1',
      customer_email: 'agent@example.com',
      customer_details: { email: 'agent@example.com' },
      metadata: { claim_id: claimId, source: 'agent_v1_keys', product: 'pro' },
    } as unknown as Stripe.Checkout.Session;

    await fulfillCheckoutSession(session);
    await fulfillCheckoutSession(session);

    expect(db.store.accounts).toBe(1);
    expect(createAccount).not.toHaveBeenCalledWith(expect.objectContaining({ tier: 'free' }));
  });
});

describe('402 schema helper', () => {
  it('requires pay_url and claim_url', () => {
    const body = paymentRequiredBody({
      pay_url: sessionUrl,
      claim_url: `https://savestate.dev/v1/keys/claims/${claimId}`,
    });
    expect(body.pay_url).toBe(sessionUrl);
    expect(body.claim_url).toContain('/v1/keys/claims/');
    expect(body.human_pay_url).toBe('https://buy.stripe.com/aFa00j5E4ees8hf3kp2ZO00');
  });
});
