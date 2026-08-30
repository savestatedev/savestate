/**
 * Live SaveState Pro checkout constants.
 *
 * Amounts and copy come from the public savestate.dev pricing offer
 * (and stripe-config.json). The agent POST /v1/keys handler builds
 * Stripe Checkout with price_data — it must not invent or send price_ IDs.
 */

export const PRO_UNIT_AMOUNT = 900;
export const PRO_CURRENCY = 'usd';
export const PRO_INTERVAL = 'month';
export const PRO_PRODUCT_NAME = 'SaveState Pro';
export const PRO_PRODUCT_DESCRIPTION =
  'Scheduled auto-backups, cloud storage, all adapters, search, dashboard';

/** Existing live Payment Link — human secondary, not used to create Checkout. */
export const HUMAN_PRO_PAYMENT_LINK =
  'https://buy.stripe.com/aFa00j5E4ees8hf3kp2ZO00';

export const HUMAN_TEAM_PAYMENT_LINK =
  'https://buy.stripe.com/8x27sLc2s4DSapn4ot2ZO01';

export const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;
export const PUBLIC_SITE = 'https://savestate.dev';
