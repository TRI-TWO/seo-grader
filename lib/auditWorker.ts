/**
 * Audit Worker Initialization
 * 
 * Sets up the background worker to process audit jobs from the queue.
 * This runs when the module is imported (e.g., when API routes are loaded).
 */

import { auditQueue } from "./auditQueue";
import { processAuditJob } from "./auditStages";

let workerInitialized = false;

/**
 * Initialize the audit worker
 * This should be called once when the server starts
 */
export function initializeAuditWorker(): void {
  if (workerInitialized) return;
  workerInitialized = true;

  // Register the processor callback
  auditQueue.setProcessor(async (jobId: string, url: string) => {
    await processAuditJob(jobId, url);
  });

  console.log("Audit worker initialized");
}

// Auto-initialize when module is imported
initializeAuditWorker();

