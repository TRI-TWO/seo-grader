/**
 * Audit Queue System
 * 
 * Uses Upstash Redis for distributed queue processing.
 * Jobs are enqueued with LPUSH and dequeued with RPOP.
 */

import { redis } from "./upstash";

const QUEUE_KEY = "audit-jobs";

type QueueItem = {
  jobId: string;
  url: string;
  enqueuedAt: number;
};

class AuditQueue {
  /**
   * Enqueue an audit job
   */
  async enqueue(jobId: string, url: string): Promise<void> {
    const item: QueueItem = {
      jobId,
      url,
      enqueuedAt: Date.now(),
    };

    await redis.lpush(QUEUE_KEY, JSON.stringify(item));
  }

  /**
   * Dequeue the next job (FIFO - removes from right side)
   * Returns null if queue is empty
   */
  async dequeue(): Promise<QueueItem | null> {
    const item = await redis.rpop<string>(QUEUE_KEY);
    if (!item) {
      return null;
    }

    try {
      return JSON.parse(item) as QueueItem;
    } catch (error) {
      console.error("Error parsing queue item:", error);
      return null;
    }
  }

  /**
   * Get queue length
   */
  async getLength(): Promise<number> {
    return await redis.llen(QUEUE_KEY);
  }

  /**
   * Peek at the next job without removing it
   */
  async peek(): Promise<QueueItem | null> {
    const items = await redis.lrange<string>(QUEUE_KEY, -1, -1);
    if (!items || items.length === 0) {
      return null;
    }

    try {
      return JSON.parse(items[0]) as QueueItem;
    } catch (error) {
      console.error("Error parsing queue item:", error);
      return null;
    }
  }
}

// Singleton instance
export const auditQueue = new AuditQueue();
