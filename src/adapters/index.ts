/**
 * Adapters module re-exports
 */

export { ClawdbotAdapter } from './clawdbot.js';
export { ClaudeCodeAdapter } from './claude-code.js';
export { ClaudeWebAdapter } from './claude-web.js';
export { OpenAIAssistantsAdapter } from './openai-assistants.js';
export { listAdapters, getAdapter, detectAdapter, getAdapterInfo } from './registry.js';
export type { Adapter, PlatformMeta, Snapshot } from './interface.js';
