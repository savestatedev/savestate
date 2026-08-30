/**
 * Stripe Webhook Handler
 *
 * Deployed as a Vercel serverless function at /api/webhook.
 * Handles subscription lifecycle events from Stripe.
 *
 * Events handled:
 * - checkout.session.completed → Create account + send API key
 *   (and, for agent claims, attach the secret to GET /v1/keys/claims/:id)
 * - customer.subscription.updated → Update tier/status
 * - customer.subscription.deleted → Downgrade to free
 * - invoice.payment_failed → Mark as past_due
 *
 * Fulfillment is ONLY via this signed webhook. success_url must not mint keys.
 * Idempotent on Stripe checkout session.id.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import {
  initDb,
  createAccount,
  updateSubscriptionStatus,
  isCheckoutSessionProcessed,
  markCheckoutSessionProcessed,
  markKeyClaimProcessing,
  issueKeyClaim,
} from './lib/db.js';
import { sendEmail, welcomeEmailHtml } from './lib/email.js';
import { CLAIM_TTL_MS } from './lib/pro-checkout.js';
import { getStripe } from './lib/stripe-client.js';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

/** Map existing live Payment Link price IDs to tiers. Agent checkouts use price_data and fall through to pro. */
const PRICE_TO_TIER: Record<string, 'pro' | 'team'> = {
  'price_1SuN4PEJ7b5sfPTDks7Q6SHO': 'pro',   // $9/mo
  'price_1SuN4PEJ7b5sfPTDmE9uHVM6': 'team',  // $29/mo
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    const body = await getRawBody(req);
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  await initDb();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await fulfillCheckoutSession(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          await updateSubscriptionStatus(
            typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id,
            'past_due',
          );
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

// ─── Event Handlers ──────────────────────────────────────────

/**
 * Mint a Pro/Team secret after a signed checkout.session.completed.
 * Idempotent on session.id. Never creates a Free-tier cloud key.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  if (await isCheckoutSessionProcessed(session.id)) {
    console.log(`Checkout session already processed: ${session.id}`);
    return;
  }

  await markKeyClaimProcessing(session.id);

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  const email =
    session.customer_details?.email ||
    session.customer_email ||
    agentFallbackEmail(session);

  if (!customerId || !subscriptionId || !email) {
    console.error('Missing required checkout data:', { customerId, subscriptionId, email });
    return;
  }

  const tier = await resolvePaidTier(session, subscriptionId);

  const account = await createAccount({
    email,
    name: session.customer_details?.name || undefined,
    tier,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });

  await issueKeyClaim({
    sessionId: session.id,
    claimId: session.metadata?.claim_id,
    apiKey: account.api_key,
    accountId: account.id,
    expiresAt: new Date(Date.now() + CLAIM_TTL_MS),
  });

  await markCheckoutSessionProcessed(session.id, account.id);

  console.log(`Account created/upgraded: ${email} → ${tier} (API key: ${account.api_key.slice(0, 12)}...)`);

  try {
    await sendEmail({
      to: email,
      subject: `Welcome to SaveState ${tier === 'team' ? 'Team' : 'Pro'} — Your API Key`,
      html: welcomeEmailHtml({
        name: session.customer_details?.name || undefined,
        email,
        apiKey: account.api_key,
        tier,
      }),
    });
    console.log(`Welcome email sent to ${email}`);
  } catch (emailErr) {
    console.error(`Failed to send welcome email to ${email}:`, emailErr);
  }
}

async function resolvePaidTier(
  session: Stripe.Checkout.Session,
  subscriptionId: string,
): Promise<'pro' | 'team'> {
  if (session.metadata?.product === 'team') return 'team';
  if (session.metadata?.source === 'agent_v1_keys') return 'pro';

  try {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price.id;
    const fromPrice = priceId ? PRICE_TO_TIER[priceId] : undefined;
    if (fromPrice) return fromPrice;

    const amount = subscription.items.data[0]?.price.unit_amount;
    if (amount === 2900) return 'team';
  } catch (err) {
    console.error('Failed to retrieve subscription for tier:', err);
  }

  return 'pro';
}

function agentFallbackEmail(session: Stripe.Checkout.Session): string | undefined {
  const claimId = session.metadata?.claim_id;
  if (!claimId) return undefined;
  return `agent-claim-${claimId}@users.savestate.dev`;
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const priceId = subscription.items.data[0]?.price.id;
  const tier = PRICE_TO_TIER[priceId];
  const status = subscription.status;

  await updateSubscriptionStatus(customerId, status, tier);
  console.log(`Subscription updated: ${customerId} → ${status} (${tier || 'unchanged'})`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  await updateSubscriptionStatus(customerId, 'canceled');
  console.log(`Subscription canceled: ${customerId}`);
}

function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
