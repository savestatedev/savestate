/**
 * Cloud Storage Proxy API
 *
 * Proxies encrypted snapshots to/from Cloudflare R2 for Pro/Team subscribers.
 * Authenticated via API key (Bearer ss_live_...).
 *
 * Endpoints:
 *   PUT  /api/storage?key=snapshots/ss-2026-... — Upload encrypted snapshot
 *   GET  /api/storage?key=snapshots/ss-2026-... — Download encrypted snapshot
 *   GET  /api/storage?list=true                 — List stored snapshots
 *   DELETE /api/storage?key=snapshots/ss-2026-... — Delete a snapshot
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDb, getAccountByApiKey, updateStorageUsageById } from './lib/db.js';
import { createHmac, createHash } from 'node:crypto';

// R2 configuration
const R2_ENDPOINT = process.env.R2_ENDPOINT || 'https://3896f91bc02fe2ec4f45b9e92981e626.r2.cloudflarestorage.com';
const R2_BUCKET = process.env.R2_BUCKET || 'savestate-backups';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_REGION = 'auto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Authenticate
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const apiKey = authHeader.slice(7);
  await initDb();

  const account = await getAccountByApiKey(apiKey);
  if (!account) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Check tier — cloud storage requires Pro or Team
  if (account.tier === 'free') {
    return res.status(403).json({
      error: 'Cloud storage requires a Pro or Team subscription',
      upgrade: 'https://savestate.dev/#pricing',
    });
  }

  // Check if R2 credentials are configured
  if (!R2_ACCESS_KEY || !R2_SECRET_KEY) {
    return res.status(503).json({ error: 'Cloud storage not configured' });
  }

  const objectKey = req.query.key as string | undefined;
  const isList = req.query.list === 'true';

  try {
    switch (req.method) {
      case 'GET': {
        if (isList) {
          return await handleList(account.id, res);
        }
        if (!objectKey) {
          return res.status(400).json({ error: 'Missing ?key= parameter' });
        }
        return await handleDownload(account.id, objectKey, res);
      }

      case 'PUT': {
        if (!objectKey) {
          return res.status(400).json({ error: 'Missing ?key= parameter' });
        }
        return await handleUpload(account, objectKey, req, res);
      }

      case 'DELETE': {
        if (!objectKey) {
          return res.status(400).json({ error: 'Missing ?key= parameter' });
        }
        return await handleDelete(account.id, objectKey, res);
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Storage error:', err);
    return res.status(500).json({ error: 'Storage operation failed' });
  }
}

// ─── Handlers ────────────────────────────────────────────────

async function handleList(accountId: string, res: VercelResponse) {
  const prefix = `accounts/${accountId}/`;
  const r2Res = await r2Request('GET', '', {
    queryParams: { 'list-type': '2', prefix, 'max-keys': '1000' },
  });

  if (!r2Res.ok) {
    return res.status(502).json({ error: 'Failed to list objects' });
  }

  const xml = await r2Res.text();
  // Parse simple XML response for keys and sizes
  const items: { key: string; size: number; lastModified: string }[] = [];
  const contentRegex = /<Contents>[\s\S]*?<Key>(.*?)<\/Key>[\s\S]*?<LastModified>(.*?)<\/LastModified>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g;
  let match;
  while ((match = contentRegex.exec(xml)) !== null) {
    items.push({
      key: match[1].replace(prefix, ''),
      lastModified: match[2],
      size: parseInt(match[3]),
    });
  }

  return res.status(200).json({ items, count: items.length });
}

async function handleDownload(accountId: string, objectKey: string, res: VercelResponse) {
  const fullKey = `accounts/${accountId}/${objectKey}`;
  const r2Res = await r2Request('GET', fullKey);

  if (r2Res.status === 404) {
    return res.status(404).json({ error: 'Snapshot not found' });
  }
  if (!r2Res.ok) {
    return res.status(502).json({ error: 'Failed to download' });
  }

  const data = Buffer.from(await r2Res.arrayBuffer());
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', data.length);
  return res.send(data);
}

async function handleUpload(
  account: { id: string; storage_used_bytes: number; storage_limit_bytes: number },
  objectKey: string,
  req: VercelRequest,
  res: VercelResponse,
) {
  // Read the body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks);

  // Check storage limit
  const newUsage = account.storage_used_bytes + body.length;
  if (newUsage > account.storage_limit_bytes) {
    return res.status(413).json({
      error: 'Storage limit exceeded',
      used: account.storage_used_bytes,
      limit: account.storage_limit_bytes,
      needed: body.length,
    });
  }

  const fullKey = `accounts/${account.id}/${objectKey}`;
  const r2Res = await r2Request('PUT', fullKey, { body });

  if (!r2Res.ok) {
    return res.status(502).json({ error: 'Failed to upload' });
  }

  // Update storage usage
  await updateStorageUsageById(account.id, newUsage);

  return res.status(200).json({
    key: objectKey,
    size: body.length,
    storageUsed: newUsage,
    storageLimit: account.storage_limit_bytes,
  });
}

async function handleDelete(accountId: string, objectKey: string, res: VercelResponse) {
  const fullKey = `accounts/${accountId}/${objectKey}`;
  const r2Res = await r2Request('DELETE', fullKey);

  if (!r2Res.ok && r2Res.status !== 204) {
    return res.status(502).json({ error: 'Failed to delete' });
  }

  return res.status(200).json({ deleted: objectKey });
}

// ─── R2 / S3 Signing ────────────────────────────────────────

interface R2RequestOpts {
  body?: Buffer;
  queryParams?: Record<string, string>;
}

async function r2Request(method: string, key: string, opts?: R2RequestOpts): Promise<Response> {
  const url = new URL(`/${R2_BUCKET}/${key}`, R2_ENDPOINT);

  if (opts?.queryParams) {
    for (const [k, v] of Object.entries(opts.queryParams)) {
      url.searchParams.set(k, v);
    }
  }

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateOnly = dateStamp.slice(0, 8);

  const bodyHash = opts?.body
    ? createHash('sha256').update(opts.body).digest('hex')
    : createHash('sha256').update('').digest('hex');

  const headers: Record<string, string> = {
    'host': new URL(R2_ENDPOINT).host,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date': dateStamp,
  };
  if (opts?.body) {
    headers['content-length'] = opts.body.length.toString();
  }

  // Build canonical request
  const sortedHeaders = Object.keys(headers).sort();
  const signedHeaders = sortedHeaders.join(';');
  const canonicalHeaders = sortedHeaders.map(h => `${h}:${headers[h]}`).join('\n') + '\n';

  const canonicalPath = url.pathname.split('/').map(s => encodeURIComponent(s)).join('/');
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [
    method,
    canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  // String to sign
  const scope = `${dateOnly}/${R2_REGION}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateStamp,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  // Signing key
  const kDate = hmacSha256(`AWS4${R2_SECRET_KEY}`, dateOnly);
  const kRegion = hmacSha256(kDate, R2_REGION);
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');

  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  headers['authorization'] = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url.toString(), {
    method,
    headers,
    body: opts?.body || undefined,
  });
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}
