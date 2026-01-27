/**
 * Adapters module re-exports
 */

export { ClawdbotAdapter } from './clawdbot.js';
export { listAdapters, getAdapter, detectAdapter, getAdapterInfo } from './registry.js';
export type { Adapter, PlatformMeta, Snapshot } from './interface.js';
