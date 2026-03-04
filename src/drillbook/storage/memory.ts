/**
 * In-Memory Drillbook Storage
 * 
 * Reference implementation for testing and development.
 */

import {
  DrillItem,
  DrillbookStorage,
  TestResult,
} from '../types.js';

export class InMemoryDrillbookStorage implements DrillbookStorage {
  private items: Map<string, DrillItem> = new Map();

  async saveItem(item: DrillItem): Promise<void> {
    this.items.set(item.id, { ...item });
  }

  async getItem(id: string): Promise<DrillItem | null> {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  async getActiveItems(created_by: string): Promise<DrillItem[]> {
    const items: DrillItem[] = [];
    
    for (const item of this.items.values()) {
      if (item.created_by === created_by && item.active) {
        // Check expiry
        if (item.expiry && new Date(item.expiry).getTime() < Date.now()) {
          continue;
        }
        items.push({ ...item });
      }
    }
    
    return items;
  }

  async getCriticalItems(created_by: string): Promise<DrillItem[]> {
    const items: DrillItem[] = [];
    
    for (const item of this.items.values()) {
      if (item.created_by === created_by && item.active && item.critical) {
        // Check expiry
        if (item.expiry && new Date(item.expiry).getTime() < Date.now()) {
          continue;
        }
        items.push({ ...item });
      }
    }
    
    return items;
  }

  async searchByTags(tags: string[]): Promise<DrillItem[]> {
    const items: DrillItem[] = [];
    
    for (const item of this.items.values()) {
      if (!item.active) continue;
      if (!item.tags) continue;
      
      if (tags.some(tag => item.tags!.includes(tag))) {
        items.push({ ...item });
      }
    }
    
    return items;
  }

  async recordTestResult(item_id: string, result: TestResult): Promise<void> {
    const item = this.items.get(item_id);
    if (!item) return;

    item.test_history.push({ ...result });
    item.last_tested_at = result.timestamp;
    
    if (!result.correct) {
      item.miss_count += 1;
    }
    
    this.items.set(item_id, item);
  }

  async retireItem(item_id: string, reason: string, replaced_by?: string): Promise<void> {
    const item = this.items.get(item_id);
    if (!item) return;

    item.active = false;
    item.retired_reason = reason;
    if (replaced_by) {
      item.replaced_by = replaced_by;
    }
    
    this.items.set(item_id, item);
  }

  async getItemsDueForTesting(created_by: string, limit: number): Promise<DrillItem[]> {
    const items: DrillItem[] = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    for (const item of this.items.values()) {
      if (item.created_by !== created_by || !item.active) continue;
      
      // Check expiry
      if (item.expiry && new Date(item.expiry).getTime() < now) {
        continue;
      }
      
      // Check if not tested recently (> 1 day) or never tested
      if (item.last_tested_at) {
        const timeSinceTest = now - new Date(item.last_tested_at).getTime();
        if (timeSinceTest < oneDayMs) continue;
      }
      
      items.push({ ...item });
    }
    
    // Sort by importance (descending) and miss_count (descending)
    items.sort((a, b) => {
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      return b.miss_count - a.miss_count;
    });
    
    return items.slice(0, limit);
  }

  // ─── Testing Helpers ───────────────────────────────────────

  clear(): void {
    this.items.clear();
  }

  getStats(): { total: number; active: number; critical: number } {
    let active = 0;
    let critical = 0;
    
    for (const item of this.items.values()) {
      if (item.active) {
        active++;
        if (item.critical) critical++;
      }
    }
    
    return {
      total: this.items.size,
      active,
      critical,
    };
  }
}
