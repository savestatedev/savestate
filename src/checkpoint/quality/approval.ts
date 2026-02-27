/**
 * Human Approval Queue
 *
 * Manages human-in-the-loop approval for low-confidence memory decisions.
 *
 * @see https://github.com/savestatedev/savestate/issues/113
 */

import type { ApprovalRequest, ApprovalDecision } from './gate.js';

export type ApprovalMode = 'auto' | 'manual' | 'hybrid';

export interface PendingApproval {
  request: ApprovalRequest;
  expiresAt?: string;
  priority: 'low' | 'medium' | 'high';
  context?: Record<string, unknown>;
}

/**
 * Approval Queue for human-in-the-loop memory decisions.
 *
 * In 'hybrid' mode, decisions below the confidence threshold
 * are queued for human review before being applied.
 */
export class ApprovalQueue {
  private pending: Map<string, PendingApproval> = new Map();
  private decisions: Map<string, ApprovalDecision> = new Map();

  /**
   * Add a request to the approval queue.
   */
  enqueue(
    request: ApprovalRequest,
    options?: {
      expiresAt?: string;
      priority?: 'low' | 'medium' | 'high';
      context?: Record<string, unknown>;
    },
  ): void {
    this.pending.set(request.id, {
      request,
      expiresAt: options?.expiresAt,
      priority: options?.priority ?? 'medium',
      context: options?.context,
    });
  }

  /**
   * Get a pending approval by ID.
   */
  get(requestId: string): PendingApproval | undefined {
    return this.pending.get(requestId);
  }

  /**
   * List all pending approvals.
   */
  list(options?: {
    priority?: 'low' | 'medium' | 'high';
    limit?: number;
  }): PendingApproval[] {
    let items = Array.from(this.pending.values());

    if (options?.priority) {
      items = items.filter((item) => item.priority === options.priority);
    }

    // Sort by priority (high > medium > low) then by creation time
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return (
        new Date(a.request.createdAt).getTime() -
        new Date(b.request.createdAt).getTime()
      );
    });

    if (options?.limit) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  /**
   * Record a decision for a pending approval.
   */
  decide(decision: ApprovalDecision): void {
    if (!this.pending.has(decision.requestId)) {
      throw new Error(`No pending approval with ID: ${decision.requestId}`);
    }

    this.decisions.set(decision.requestId, decision);
    this.pending.delete(decision.requestId);
  }

  /**
   * Get the decision for a request (if any).
   */
  getDecision(requestId: string): ApprovalDecision | undefined {
    return this.decisions.get(requestId);
  }

  /**
   * Check if a request is pending.
   */
  isPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  /**
   * Get the count of pending approvals.
   */
  pendingCount(): number {
    return this.pending.size;
  }

  /**
   * Clear expired approvals.
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [id, item] of this.pending.entries()) {
      if (item.expiresAt && new Date(item.expiresAt).getTime() < now) {
        this.pending.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}
