import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HUMAN_PRO_PAYMENT_LINK, PUBLIC_SITE } from './pro-checkout.js';

export function setCors(res: VercelResponse, methods: string): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

export function publicBaseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) || 'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ||
    (req.headers.host as string | undefined);
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return `${proto}://${host}`;
  }
  return PUBLIC_SITE;
}

export function claimUrl(base: string, claimId: string): string {
  return `${base}/v1/keys/claims/${claimId}`;
}

export function paymentRequiredBody(params: {
  pay_url: string;
  claim_url: string;
  error?: string;
}): Record<string, unknown> {
  return {
    error: params.error ?? 'payment_required',
    pay_url: params.pay_url,
    claim_url: params.claim_url,
    human_pay_url: HUMAN_PRO_PAYMENT_LINK,
    amount_cents: 900,
    interval: 'month',
    product: 'SaveState Pro',
  };
}

export function parseJsonBody(req: VercelRequest): Record<string, unknown> {
  const body = req.body;
  if (body == null || body === '') return {};
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return {};
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}
