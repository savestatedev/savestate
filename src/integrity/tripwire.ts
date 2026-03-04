/**
 * Tripwire Monitor - Memory Integrity Grid
 *
 * Runtime detector that watches for honeyfact leakage in outputs and tool calls.
 * When triggered, emits IntegrityIncident events for containment response.
 *
 * @see https://github.com/savestatedev/savestate/issues/112
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { localConfigDir } from '../config.js';
import { checkForHoneyfacts, type HoneyfactTemplate } from './honeyfact.js';

// ─── Types ───────────────────────────────────────────────────

/**
 * Where the honeyfact was detected.
 */
export type DetectionSource =
  | 'output'       // Agent output/response
  | 'tool_call'    // Tool invocation arguments
  | 'tool_result'  // Tool execution result
  | 'memory_write' // Memory write operation
  | 'external';    // External API call

/**
 * Severity levels for incidents.
 */
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * A tripwire event when honeyfact leakage is detected.
 */
export interface TripwireEvent {
  /** Unique event identifier */
  id: string;

  /** ISO timestamp of detection */
  timestamp: string;

  /** ID of the honeyfact that was detected */
  honeyfact_id: string;

  /** Where the leakage was detected */
  detected_in: DetectionSource;

  /** Confidence score (0-1) for fuzzy matches */
  confidence: number;

  /** Context around the detection */
  context: TripwireContext;

  /** Tenant ID */
  tenant_id: string;
}

/**
 * Context information for the detection.
 */
export interface TripwireContext {
  /** The content that triggered detection */
  matched_content: string;

  /** Surrounding content (truncated) */
  surrounding?: string;

  /** Tool name if detected in tool call */
  tool_name?: string;

  /** Tool arguments if applicable */
  tool_args?: Record<string, unknown>;

  /** Memory ID if related to memory operation */
  memory_id?: string;

  /** Session/checkpoint ID */
  session_id?: string;

  /** Any additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * An integrity incident representing detected memory poisoning.
 */
export interface IntegrityIncident {
  /** Unique incident identifier */
  id: string;

  /** ISO timestamp of incident creation */
  created_at: string;

  /** Incident severity */
  severity: IncidentSeverity;

  /** Type of incident */
  type: 'honeyfact_leak' | 'memory_tampering' | 'injection_attempt';

  /** Triggering events */
  events: TripwireEvent[];

  /** Current status */
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'false_positive';

  /** Tenant ID */
  tenant_id: string;

  /** ISO timestamp of last update */
  updated_at: string;

  /** Resolution notes */
  resolution_notes?: string;

  /** User who resolved (if applicable) */
  resolved_by?: string;
}

/**
 * Monitor configuration.
 */
export interface TripwireConfig {
  /** Fuzzy match threshold (0-1, default: 0.8) */
  threshold: number;

  /** Enable fuzzy matching (default: true) */
  fuzzy_enabled: boolean;

  /** Sources to monitor */
  monitored_sources: DetectionSource[];

  /** Minimum severity to emit incidents */
  min_severity: IncidentSeverity;
}

/**
 * Monitor result.
 */
export interface MonitorResult {
  /** Whether any honeyfacts were detected */
  triggered: boolean;

  /** Detected events */
  events: TripwireEvent[];

  /** Created incident (if any) */
  incident?: IntegrityIncident;

  /** Monitoring duration in ms */
  duration_ms: number;
}

// ─── Default Configuration ───────────────────────────────────

export const DEFAULT_TRIPWIRE_CONFIG: TripwireConfig = {
  threshold: 0.8,
  fuzzy_enabled: true,
  monitored_sources: ['output', 'tool_call', 'tool_result', 'memory_write'],
  min_severity: 'low',
};

// ─── Incident Store ──────────────────────────────────────────

const INCIDENTS_FILE = 'integrity-incidents.json';

interface IncidentStore {
  incidents: IntegrityIncident[];
  events: TripwireEvent[];
  version: string;
}

async function loadIncidents(cwd?: string): Promise<IncidentStore> {
  const dir = localConfigDir(cwd);
  const path = join(dir, INCIDENTS_FILE);

  if (!existsSync(path)) {
    return {
      incidents: [],
      events: [],
      version: '1.0.0',
    };
  }

  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as IncidentStore;
}

async function saveIncidents(store: IncidentStore, cwd?: string): Promise<void> {
  const dir = localConfigDir(cwd);
  await mkdir(dir, { recursive: true });
  const path = join(dir, INCIDENTS_FILE);
  await writeFile(path, JSON.stringify(store, null, 2) + '\n', 'utf-8');
}

// ─── Fuzzy Matching ──────────────────────────────────────────

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio between two strings (0-1).
 */
function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Find fuzzy matches for honeyfact in content.
 */
function findFuzzyMatches(
  content: string,
  honeyfact: HoneyfactTemplate,
  threshold: number,
): { matched: boolean; confidence: number; matched_content: string } {
  const normalizedContent = content.toLowerCase();
  const honeyfactContent = honeyfact.content.toLowerCase();

  // First, try exact match
  if (normalizedContent.includes(honeyfactContent)) {
    return {
      matched: true,
      confidence: 1.0,
      matched_content: honeyfact.content,
    };
  }

  // For fuzzy matching, scan for similar substrings
  const hfLength = honeyfactContent.length;
  let bestMatch = { matched: false, confidence: 0, matched_content: '' };

  // Slide a window of similar size over the content
  for (let i = 0; i <= normalizedContent.length - Math.floor(hfLength * 0.7); i++) {
    const windowSize = Math.min(hfLength + 5, normalizedContent.length - i);
    const window = normalizedContent.substring(i, i + windowSize);

    const similarity = similarityRatio(window, honeyfactContent);

    if (similarity >= threshold && similarity > bestMatch.confidence) {
      bestMatch = {
        matched: true,
        confidence: similarity,
        matched_content: content.substring(i, i + windowSize),
      };
    }
  }

  return bestMatch;
}

// ─── Severity Calculation ────────────────────────────────────

function calculateSeverity(
  events: TripwireEvent[],
  honeyfacts: HoneyfactTemplate[],
): IncidentSeverity {
  // Critical: Multiple honeyfacts or high-confidence external leak
  if (events.length >= 3) return 'critical';
  if (events.some(e => e.detected_in === 'external' && e.confidence >= 0.9)) {
    return 'critical';
  }

  // High: API keys or instructions leaked
  const leakedCategories = new Set(
    honeyfacts
      .filter(hf => events.some(e => e.honeyfact_id === hf.id))
      .map(hf => hf.category)
  );

  if (leakedCategories.has('api_key') || leakedCategories.has('instruction')) {
    return 'high';
  }

  // Medium: Multiple events or tool calls
  if (events.length >= 2 || events.some(e => e.detected_in === 'tool_call')) {
    return 'medium';
  }

  // Low: Single event in output
  return 'low';
}

// ─── Tripwire Monitor Class ──────────────────────────────────

export class TripwireMonitor {
  private config: TripwireConfig;
  private cwd?: string;

  constructor(config?: Partial<TripwireConfig>, cwd?: string) {
    this.config = { ...DEFAULT_TRIPWIRE_CONFIG, ...config };
    this.cwd = cwd;
  }

  /**
   * Monitor output for honeyfact leakage.
   */
  async monitorOutput(
    output: string,
    tenant_id: string,
    context?: Partial<TripwireContext>,
  ): Promise<MonitorResult> {
    return this.monitor(output, 'output', tenant_id, context);
  }

  /**
   * Monitor tool call for honeyfact leakage.
   */
  async monitorToolCall(
    tool_name: string,
    args: Record<string, unknown>,
    tenant_id: string,
    context?: Partial<TripwireContext>,
  ): Promise<MonitorResult> {
    const content = JSON.stringify(args);
    return this.monitor(content, 'tool_call', tenant_id, {
      ...context,
      tool_name,
      tool_args: args,
    });
  }

  /**
   * Monitor tool result for honeyfact leakage.
   */
  async monitorToolResult(
    result: string,
    tool_name: string,
    tenant_id: string,
    context?: Partial<TripwireContext>,
  ): Promise<MonitorResult> {
    return this.monitor(result, 'tool_result', tenant_id, {
      ...context,
      tool_name,
    });
  }

  /**
   * Monitor memory write for honeyfact leakage.
   */
  async monitorMemoryWrite(
    content: string,
    memory_id: string,
    tenant_id: string,
    context?: Partial<TripwireContext>,
  ): Promise<MonitorResult> {
    return this.monitor(content, 'memory_write', tenant_id, {
      ...context,
      memory_id,
    });
  }

  /**
   * Core monitoring function.
   */
  private async monitor(
    content: string,
    source: DetectionSource,
    tenant_id: string,
    context?: Partial<TripwireContext>,
  ): Promise<MonitorResult> {
    const startTime = Date.now();

    if (!this.config.monitored_sources.includes(source)) {
      return {
        triggered: false,
        events: [],
        duration_ms: Date.now() - startTime,
      };
    }

    // Check for honeyfacts
    const matchedHoneyfacts = await checkForHoneyfacts(content, tenant_id, this.cwd);
    const events: TripwireEvent[] = [];

    // Create events for exact matches
    for (const hf of matchedHoneyfacts) {
      events.push({
        id: `te_${randomUUID().slice(0, 12)}`,
        timestamp: new Date().toISOString(),
        honeyfact_id: hf.id,
        detected_in: source,
        confidence: 1.0,
        context: {
          matched_content: hf.content,
          surrounding: this.extractSurrounding(content, hf.content),
          ...context,
        },
        tenant_id,
      });
    }

    // If fuzzy matching enabled, check for partial matches
    if (this.config.fuzzy_enabled && events.length === 0) {
      const { getActiveHoneyfacts } = await import('./honeyfact.js');
      const activeHoneyfacts = await getActiveHoneyfacts(tenant_id, this.cwd);

      for (const hf of activeHoneyfacts) {
        const match = findFuzzyMatches(content, hf, this.config.threshold);
        if (match.matched && !events.some(e => e.honeyfact_id === hf.id)) {
          events.push({
            id: `te_${randomUUID().slice(0, 12)}`,
            timestamp: new Date().toISOString(),
            honeyfact_id: hf.id,
            detected_in: source,
            confidence: match.confidence,
            context: {
              matched_content: match.matched_content,
              surrounding: this.extractSurrounding(content, match.matched_content),
              ...context,
            },
            tenant_id,
          });
        }
      }
    }

    let incident: IntegrityIncident | undefined;

    if (events.length > 0) {
      // Get all honeyfacts for severity calculation
      const { getAllHoneyfacts } = await import('./honeyfact.js');
      const allHoneyfacts = await getAllHoneyfacts(this.cwd);
      const severity = calculateSeverity(events, allHoneyfacts);

      // Create incident
      incident = await this.createIncident(events, severity, tenant_id);
    }

    return {
      triggered: events.length > 0,
      events,
      incident,
      duration_ms: Date.now() - startTime,
    };
  }

  /**
   * Extract surrounding content for context.
   */
  private extractSurrounding(content: string, match: string): string {
    const index = content.toLowerCase().indexOf(match.toLowerCase());
    if (index === -1) return '';

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + match.length + 50);
    let surrounding = content.substring(start, end);

    if (start > 0) surrounding = '...' + surrounding;
    if (end < content.length) surrounding = surrounding + '...';

    return surrounding;
  }

  /**
   * Create an integrity incident.
   */
  private async createIncident(
    events: TripwireEvent[],
    severity: IncidentSeverity,
    tenant_id: string,
  ): Promise<IntegrityIncident> {
    const store = await loadIncidents(this.cwd);
    const now = new Date().toISOString();

    const incident: IntegrityIncident = {
      id: `ii_${randomUUID().slice(0, 12)}`,
      created_at: now,
      severity,
      type: 'honeyfact_leak',
      events,
      status: 'open',
      tenant_id,
      updated_at: now,
    };

    store.incidents.push(incident);
    store.events.push(...events);
    await saveIncidents(store, this.cwd);

    return incident;
  }
}

// ─── Incident Management ─────────────────────────────────────

/**
 * Get all incidents.
 */
export async function getIncidents(
  tenant_id?: string,
  status?: IntegrityIncident['status'],
  cwd?: string,
): Promise<IntegrityIncident[]> {
  const store = await loadIncidents(cwd);
  return store.incidents.filter(inc =>
    (!tenant_id || inc.tenant_id === tenant_id) &&
    (!status || inc.status === status)
  );
}

/**
 * Get incident by ID.
 */
export async function getIncident(
  id: string,
  cwd?: string,
): Promise<IntegrityIncident | null> {
  const store = await loadIncidents(cwd);
  return store.incidents.find(inc => inc.id === id) ?? null;
}

/**
 * Update incident status.
 */
export async function updateIncidentStatus(
  id: string,
  status: IntegrityIncident['status'],
  resolution_notes?: string,
  resolved_by?: string,
  cwd?: string,
): Promise<IntegrityIncident | null> {
  const store = await loadIncidents(cwd);
  const incident = store.incidents.find(inc => inc.id === id);

  if (!incident) return null;

  incident.status = status;
  incident.updated_at = new Date().toISOString();
  if (resolution_notes) incident.resolution_notes = resolution_notes;
  if (resolved_by) incident.resolved_by = resolved_by;

  await saveIncidents(store, cwd);
  return incident;
}

/**
 * Get all tripwire events.
 */
export async function getTripwireEvents(
  tenant_id?: string,
  cwd?: string,
): Promise<TripwireEvent[]> {
  const store = await loadIncidents(cwd);
  return tenant_id
    ? store.events.filter(e => e.tenant_id === tenant_id)
    : store.events;
}

/**
 * Get incident statistics.
 */
export async function getIncidentStats(
  tenant_id?: string,
  cwd?: string,
): Promise<{
  total: number;
  by_status: Record<IntegrityIncident['status'], number>;
  by_severity: Record<IncidentSeverity, number>;
  events_total: number;
}> {
  const store = await loadIncidents(cwd);
  const filtered = tenant_id
    ? store.incidents.filter(inc => inc.tenant_id === tenant_id)
    : store.incidents;

  const by_status: Record<IntegrityIncident['status'], number> = {
    open: 0,
    investigating: 0,
    contained: 0,
    resolved: 0,
    false_positive: 0,
  };

  const by_severity: Record<IncidentSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const inc of filtered) {
    by_status[inc.status]++;
    by_severity[inc.severity]++;
  }

  const events = tenant_id
    ? store.events.filter(e => e.tenant_id === tenant_id)
    : store.events;

  return {
    total: filtered.length,
    by_status,
    by_severity,
    events_total: events.length,
  };
}
