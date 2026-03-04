/**
 * Integrity Grid API
 *
 * Memory Integrity Grid endpoints for honeyfact seeding, incident monitoring,
 * and containment controls.
 *
 * Endpoints:
 *   POST /api/integrity/seed          - Trigger honeyfact seeding
 *   GET  /api/integrity/incidents     - List integrity incidents
 *   GET  /api/integrity/incidents/:id - Get incident details
 *   POST /api/integrity/quarantine    - Quarantine a memory/agent
 *   POST /api/integrity/release       - Release from quarantine
 *   GET  /api/integrity/status        - Monitoring status
 *
 * @see https://github.com/savestatedev/savestate/issues/112
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Note: In a real deployment, these would import from built modules.
// For Vercel serverless, you'd need to build the integrity modules
// as part of the deployment. This is a template showing the API shape.

/**
 * Response types for the API.
 */
interface IntegrityStatusResponse {
  enabled: boolean;
  honeyfacts: {
    total: number;
    active: number;
    expired: number;
  };
  incidents: {
    total: number;
    open: number;
    contained: number;
    resolved: number;
  };
  containment: {
    policy: string;
    quarantined_memories: number;
    quarantined_agents: number;
    pending_approvals: number;
  };
}

interface SeedRequest {
  tenant_id?: string;
  count?: number;
  ttl_days?: number;
}

interface QuarantineRequest {
  target_id: string;
  target_type: 'memory' | 'agent';
  reason: string;
  tenant_id?: string;
  force?: boolean;
}

interface ReleaseRequest {
  target_id: string;
  reason?: string;
  released_by?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing API key',
      hint: 'Include Authorization: Bearer ss_live_...',
    });
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey.startsWith('ss_live_')) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  // Parse the path to determine the action
  const url = new URL(req.url ?? '', `https://${req.headers.host}`);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Expected: ['api', 'integrity', action, ...args]

  if (pathParts.length < 3) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const action = pathParts[2];
  const args = pathParts.slice(3);

  try {
    switch (action) {
      case 'status':
        return handleStatus(req, res);

      case 'seed':
        return handleSeed(req, res);

      case 'incidents':
        if (args.length > 0) {
          return handleIncidentDetail(req, res, args[0]);
        }
        return handleIncidentsList(req, res);

      case 'quarantine':
        return handleQuarantine(req, res);

      case 'release':
        return handleRelease(req, res);

      default:
        return res.status(404).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('Integrity API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/integrity/status
 * Returns current integrity monitoring status.
 */
async function handleStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // In production, this would call the actual integrity modules
  const status: IntegrityStatusResponse = {
    enabled: true,
    honeyfacts: {
      total: 10,
      active: 10,
      expired: 0,
    },
    incidents: {
      total: 0,
      open: 0,
      contained: 0,
      resolved: 0,
    },
    containment: {
      policy: 'approve',
      quarantined_memories: 0,
      quarantined_agents: 0,
      pending_approvals: 0,
    },
  };

  return res.status(200).json(status);
}

/**
 * POST /api/integrity/seed
 * Trigger honeyfact seeding.
 */
async function handleSeed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as SeedRequest;
  const tenant_id = body.tenant_id ?? 'default';
  const count = body.count ?? 10;
  const ttl_days = body.ttl_days ?? 7;

  // In production, this would call seedHoneyfacts()
  const result = {
    success: true,
    count,
    tenant_id,
    seeded_at: new Date().toISOString(),
    message: `Seeded ${count} honeyfacts with TTL of ${ttl_days} days`,
  };

  return res.status(200).json(result);
}

/**
 * GET /api/integrity/incidents
 * List integrity incidents.
 */
async function handleIncidentsList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url ?? '', `https://${req.headers.host}`);
  const tenant_id = url.searchParams.get('tenant_id') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

  // In production, this would call getIncidents()
  const incidents: unknown[] = [];

  return res.status(200).json({
    incidents,
    total: incidents.length,
    filters: { tenant_id, status, limit },
  });
}

/**
 * GET /api/integrity/incidents/:id
 * Get incident details.
 */
async function handleIncidentDetail(
  req: VercelRequest,
  res: VercelResponse,
  incidentId: string,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // In production, this would call getIncident()
  // For now, return not found
  return res.status(404).json({ error: `Incident not found: ${incidentId}` });
}

/**
 * POST /api/integrity/quarantine
 * Quarantine a memory or agent.
 */
async function handleQuarantine(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as QuarantineRequest;

  if (!body.target_id) {
    return res.status(400).json({ error: 'target_id is required' });
  }

  if (!body.target_type || !['memory', 'agent'].includes(body.target_type)) {
    return res.status(400).json({ error: 'target_type must be "memory" or "agent"' });
  }

  if (!body.reason) {
    return res.status(400).json({ error: 'reason is required' });
  }

  // In production, this would call ContainmentController.quarantineMemory/Agent()
  const result = {
    success: true,
    event: {
      id: `ce_${Date.now().toString(16)}`,
      action: `quarantine_${body.target_type}`,
      target_id: body.target_id,
      target_type: body.target_type,
      timestamp: new Date().toISOString(),
      policy: 'api',
      reason: body.reason,
    },
    requires_approval: !body.force,
  };

  return res.status(200).json(result);
}

/**
 * POST /api/integrity/release
 * Release a memory or agent from quarantine.
 */
async function handleRelease(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as ReleaseRequest;

  if (!body.target_id) {
    return res.status(400).json({ error: 'target_id is required' });
  }

  // In production, this would call ContainmentController.releaseMemory/Agent()
  const result = {
    success: true,
    event: {
      id: `ce_${Date.now().toString(16)}`,
      action: 'release',
      target_id: body.target_id,
      timestamp: new Date().toISOString(),
      policy: 'api',
      reason: body.reason ?? 'Released via API',
      released_by: body.released_by,
    },
  };

  return res.status(200).json(result);
}
