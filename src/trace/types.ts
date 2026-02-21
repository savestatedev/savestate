/**
 * Askable Echoes Trace Ledger types.
 */

/** Current on-disk trace schema version. */
export const TRACE_SCHEMA_VERSION = 1;

/** JSON-serializable value. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type TraceEventType =
  | 'tool_call'
  | 'tool_result'
  | 'message'
  | 'checkpoint'
  | 'error';

export interface TraceEvent {
  timestamp: string;
  run_id: string;
  adapter: string;
  event_type: TraceEventType;
  payload: JsonValue;
  tags?: string[];
}

export interface TraceRunIndexEntry {
  run_id: string;
  adapter: string;
  file: string;
  event_count: number;
  started_at: string;
  updated_at: string;
  tags?: string[];
}

export interface TraceIndexFile {
  schema_version: number;
  runs: TraceRunIndexEntry[];
}

export interface SnapshotTrace {
  schema_version: number;
  index: TraceRunIndexEntry[];
  runs: Record<string, string>;
}

