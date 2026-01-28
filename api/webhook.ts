/**
 * Stripe Webhook Handler
 *
 * Deployed as a Vercel serverless function at /api/webhook.
 * Handles subscription lifecycle events from Stripe.
 *
 * Events handled:
 * - checkout.session.completed → Create account + send API key
 * - customer.subscription.updated → Update tier/status
 * - customer.subscription.deleted → Downgrade to free
 * - invoice.payment_failed → Mark as past_due
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { initDb, createAccount, updateSubscriptionStatus, getAccountByStripeCustomer } from './lib/db.js';
import { sendEmail, welcomeEmailHtml } from './lib/email.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/** Map Stripe price IDs to SaveState tiers */
const PRICE_TO_TIER: Record<string, 'pro' | 'team'> = {
  'price_1SuN4PEJ7b5sfPTDks7Q6SHO': 'pro',   // $9/mo
  'price_1SuN4PEJ7b5sfPTDmE9uHVM6': 'team',  // $29/mo
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Stripe signature
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    const body = await getRawBody(req);
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Initialize DB
  await initDb();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  const email = session.customer_details?.email || session.customer_email;

  if (!customerId || !subscriptionId || !email) {
    console.error('Missing required checkout data:', { customerId, subscriptionId, email });
    return;
  }

  // Get subscription to determine tier from price
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = PRICE_TO_TIER[priceId] || 'pro';

  // Create or upgrade account
  const account = await createAccount({
    email,
    name: session.customer_details?.name || undefined,
    tier,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });

  console.log(`Account created/upgraded: ${email} → ${tier} (API key: ${account.api_key.slice(0, 12)}...)`);

  // Send welcome email with API key
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
    // Don't fail the webhook if email fails — account is still created
    console.error(`Failed to send welcome email to ${email}:`, emailErr);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const priceId = subscription.items.data[0]?.price.id;
  const tier = PRICE_TO_TIER[priceId];
  const status = subscription.status; // active, past_due, canceled, etc.

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

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Read raw request body for Stripe signature verification.
 */
function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
