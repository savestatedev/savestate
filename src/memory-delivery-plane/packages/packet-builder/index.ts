/**
 * Memory Delivery Plane - Packet Builder
 * 
 * Distills memories into compact task packets to reduce context sent to LLMs.
 */

import type { MemoryEntry, KnowledgeDocument } from '../../../types.js';

/**
 * A compact representation of a distilled memory
 */
export interface DistilledMemory {
  id: string;
  summary: string;
  importance: number; // 0-1 score
  source: string;
  keyTopics: string[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * A compact task packet containing distilled memories
 */
export interface TaskPacket {
  version: string;
  timestamp: string;
  originalCount: number;
  distilledCount: number;
  compressionRatio: number;
  memories: DistilledMemory[];
  metadata: {
    distillationMethod: string;
    originalSize: number;
    packetSize: number;
  };
}

/**
 * Options for packet distillation
 */
export interface DistillationOptions {
  /** Maximum number of memories to include in the packet */
  maxMemories?: number;
  /** Minimum importance threshold (0-1) */
  minImportance?: number;
  /** Maximum length of each memory summary */
  maxSummaryLength?: number;
  /** Whether to include knowledge documents */
  includeKnowledge?: boolean;
}

/**
 * Packet Builder - distills memories into compact task packets
 */
export class PacketBuilder {
  private defaultOptions: Required<DistillationOptions> = {
    maxMemories: 10,
    minImportance: 0.1,
    maxSummaryLength: 200,
    includeKnowledge: true,
  };

  /**
   * Distills memories into a compact task packet
   * @param memories - The memories to distill
   * @param options - Optional distillation options
   * @returns A compact task packet
   */
  distill(memories: MemoryEntry[], options?: DistillationOptions): TaskPacket {
    const opts = { ...this.defaultOptions, ...options };
    
    // Calculate original size
    const originalSize = this.calculateSize(memories);
    
    // Filter by importance
    const filteredMemories = memories
      .filter(m => this.calculateImportance(m) >= opts.minImportance)
      .sort((a, b) => this.calculateImportance(b) - this.calculateImportance(a))
      .slice(0, opts.maxMemories);
    
    // Distill each memory
    const distilledMemories: DistilledMemory[] = filteredMemories.map(memory => 
      this.distillMemory(memory, opts.maxSummaryLength)
    );
    
    // Calculate compressed size
    const packetSize = this.calculateDistilledSize(distilledMemories);
    const compressionRatio = originalSize > 0 ? (1 - packetSize / originalSize) : 0;
    
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      originalCount: memories.length,
      distilledCount: distilledMemories.length,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      memories: distilledMemories,
      metadata: {
        distillationMethod: 'importance-based',
        originalSize,
        packetSize,
      },
    };
  }

  /**
   * Distills knowledge documents into a compact format
   * @param documents - The knowledge documents to distill
   * @returns Compact representation of knowledge
   */
  distillKnowledge(documents: KnowledgeDocument[]): Array<{
    id: string;
    filename: string;
    summary: string;
    keyTopics: string[];
  }> {
    return documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      summary: this.summarize(doc.filename, doc.mimeType),
      keyTopics: this.extractTopics(doc.filename),
    }));
  }

  /**
   * Calculate importance score for a memory
   */
  private calculateImportance(memory: MemoryEntry): number {
    // Simple heuristic: based on content length and metadata
    let score = 0.5; // base score
    
    // Recent memories are more important
    if (memory.updatedAt) {
      const daysSinceUpdate = (Date.now() - new Date(memory.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 0.3 - daysSinceUpdate / 30); // Decay over 30 days
    }
    
    // Longer content might be more important (up to a point)
    const contentLength = memory.content.length;
    if (contentLength > 100) score += 0.1;
    if (contentLength > 500) score += 0.1;
    
    // Cap at 1.0
    return Math.min(1, score);
  }

  /**
   * Distill a single memory into a compact representation
   */
  private distillMemory(memory: MemoryEntry, maxSummaryLength: number): DistilledMemory {
    const summary = this.createSummary(memory.content, maxSummaryLength);
    const keyTopics = this.extractTopics(memory.content);
    
    return {
      id: memory.id,
      summary,
      importance: this.calculateImportance(memory),
      source: memory.source,
      keyTopics,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  }

  /**
   * Create a summary of content
   */
  private createSummary(content: string, maxLength: number): string {
    // Simple extraction-based summarization
    // Take first sentence(s) up to maxLength
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    
    if (sentences.length === 0) {
      return content.slice(0, maxLength);
    }
    
    let summary = '';
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (summary.length + trimmed.length + 1 > maxLength) {
        break;
      }
      summary += (summary ? '. ' : '') + trimmed;
    }
    
    return summary || content.slice(0, maxLength);
  }

  /**
   * Extract key topics from content
   */
  private extractTopics(content: string): string[] {
    // Simple keyword extraction
    const words = content.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    // Count frequency
    const freq: Record<string, number> = {};
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }
    
    // Get top topics
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Summarize a knowledge document based on filename and mime type
   */
  private summarize(filename: string, mimeType: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      'md': 'Markdown document',
      'txt': 'Text document',
      'pdf': 'PDF document',
      'json': 'JSON data',
      'js': 'JavaScript code',
      'ts': 'TypeScript code',
      'py': 'Python code',
    };
    
    return `${typeMap[ext] || 'Document'}: ${filename}`;
  }

  /**
   * Calculate byte size of memories
   */
  private calculateSize(memories: MemoryEntry[]): number {
    return JSON.stringify(memories).length;
  }

  /**
   * Calculate byte size of distilled memories
   */
  private calculateDistilledSize(memories: DistilledMemory[]): number {
    return JSON.stringify(memories).length;
  }
}

export default PacketBuilder;
