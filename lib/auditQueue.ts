/**
 * Audit Queue System
 * 
 * Simple in-memory queue for processing audit jobs.
 * Can be swapped later for Redis/Cloud Tasks/SQS.
 */

type QueueItem = {
  jobId: string;
  url: string;
  enqueuedAt: Date;
};

class AuditQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private processCallback: ((jobId: string, url: string) => Promise<void>) | null = null;

  /**
   * Enqueue an audit job
   */
  enqueue(jobId: string, url: string): void {
    this.queue.push({
      jobId,
      url,
      enqueuedAt: new Date(),
    });

    // Start processing if not already running
    if (!this.processing) {
      this.startWorker();
    }
  }

  /**
   * Register the processing callback
   */
  setProcessor(callback: (jobId: string, url: string) => Promise<void>): void {
    this.processCallback = callback;
  }

  /**
   * Get queue length
   */
  getLength(): number {
    return this.queue.length;
  }

  /**
   * Start the worker loop
   */
  private async startWorker(): void {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.processCallback) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        await this.processCallback(item.jobId, item.url);
      } catch (error) {
        console.error(`Error processing job ${item.jobId}:`, error);
        // Continue processing other jobs even if one fails
      }

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processing = false;
  }
}

// Singleton instance
export const auditQueue = new AuditQueue();

