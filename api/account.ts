/**
 * Account API
 *
 * GET /api/account — Validate API key and return account info.
 * Used by the CLI to check subscription tier and feature access.
 *
 * Headers:
 *   Authorization: Bearer ss_live_...
 *
 * Response:
 *   { tier, features, storage: { used, limit }, status }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDb, getAccountByApiKey } from './lib/db.js';

/** Features available per tier */
const TIER_FEATURES: Record<string, string[]> = {
  free: [
    'local-storage',
    'manual-snapshot',
    'encryption',
    'single-adapter',
  ],
  pro: [
    'local-storage',
    'cloud-storage',
    'manual-snapshot',
    'auto-backup',
    'encryption',
    'all-adapters',
    'search',
    'web-dashboard',
    'email-alerts',
  ],
  team: [
    'local-storage',
    'cloud-storage',
    'manual-snapshot',
    'auto-backup',
    'encryption',
    'all-adapters',
    'custom-adapters',
    'search',
    'web-dashboard',
    'email-alerts',
    'shared-backups',
    'compliance',
    'sso',
    'priority-support',
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing API key',
      hint: 'Run `savestate login` to authenticate, or include Authorization: Bearer ss_live_...',
    });
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey.startsWith('ss_live_')) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  await initDb();

  const account = await getAccountByApiKey(apiKey);
  if (!account) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Check if subscription is active
  const isActive = account.stripe_status === 'active' || account.tier === 'free';
  const effectiveTier = isActive ? account.tier : 'free';

  return res.status(200).json({
    id: account.id,
    email: account.email,
    tier: effectiveTier,
    status: account.stripe_status,
    features: TIER_FEATURES[effectiveTier] || TIER_FEATURES.free,
    storage: {
      used: account.storage_used_bytes,
      limit: account.storage_limit_bytes,
      remaining: Math.max(0, account.storage_limit_bytes - account.storage_used_bytes),
    },
    adapters: effectiveTier === 'free' ? 1 : effectiveTier === 'pro' ? 6 : 'unlimited',
  });
}
