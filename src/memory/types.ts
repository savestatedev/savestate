/**
 * Memory Persistence Layer - Types
 * Issue #175: Foundational storage for persistent agent memory
 */

export type MemoryType = 'fact' | 'event' | 'preference' | 'conversation';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, any>;
  importance?: number; // 0-1 scale, defaults to 0.5
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  tags?: string[];
}

export interface FactMemory extends MemoryEntry {
  type: 'fact';
  confidence: number; // 0-1 scale
  source?: string;
}

export interface EventMemory extends MemoryEntry {
  type: 'event';
  timestamp: string;
  participants?: string[];
}

export interface PreferenceMemory extends MemoryEntry {
  type: 'preference';
  category: string;
  value: any;
}

export interface ConversationMemory extends MemoryEntry {
  type: 'conversation';
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
}

export interface MemoryQuery {
  type?: MemoryType;
  tags?: string[];
  minImportance?: number;
  limit?: number;
  offset?: number;
  search?: string;
  since?: string;
  until?: string;
}

export interface MemoryStats {
  totalEntries: number;
  byType: Record<MemoryType, number>;
  oldestEntry?: string;
  newestEntry?: string;
}
