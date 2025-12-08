/**
 * Audit Queue System
 * 
 * Uses Upstash Redis for distributed queue processing.
 * Jobs are enqueued with RPUSH and dequeued with LPOP (true FIFO).
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

    try {
      const result = await redis.rpush(QUEUE_KEY, JSON.stringify(item));
      console.log(`Enqueued job ${jobId} to queue, result:`, result);
    } catch (error) {
      console.error(`Error enqueueing job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Dequeue the next job (FIFO - removes from left side)
   * Returns null if queue is empty
   */
  async dequeue(): Promise<QueueItem | null> {
    const item = await redis.lpop<string>(QUEUE_KEY);
    if (!item) {
      return null;
    }

    try {
      // Handle both string and already-parsed object cases
      if (typeof item === 'string') {
        return JSON.parse(item) as QueueItem;
      } else {
        // Already an object (Upstash may auto-parse)
        return item as QueueItem;
      }
    } catch (error) {
      console.error("Error parsing queue item:", error, "Item type:", typeof item, "Item:", item);
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
