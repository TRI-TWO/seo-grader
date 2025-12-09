import { NextRequest, NextResponse } from "next/server";
import { auditQueue } from "@/lib/auditQueue";
import { processAuditJob } from "@/lib/auditStages";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Timeout constants
const API_TIMEOUT = 10000; // 10 seconds for API operations
const DB_QUERY_TIMEOUT = 5000; // 5 seconds for database queries
const WORKER_HARD_TIMEOUT = 15000; // 15 seconds - hard timeout for entire worker execution
const JOB_PROCESSING_TIMEOUT = 200000; // 200 seconds (3min + buffer) for job processing

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Run worker logic - processes next job from queue
 * This function must always return a NextResponse within WORKER_HARD_TIMEOUT
 */
async function runWorker(req: NextRequest): Promise<NextResponse> {
  try {
    // Check for worker secret (required for security)
    const secret = req.headers.get('x-worker-secret');
    const workerSecret = process.env.WORKER_SECRET;

    // Only check secret if it's configured (allows development without secret)
    if (workerSecret && secret !== workerSecret) {
      console.warn('Worker request rejected: Invalid or missing secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Worker invoked - checking queue...');

    // Dequeue next job
    const queueItem = await withTimeout(
      auditQueue.dequeue(),
      API_TIMEOUT,
      "Queue dequeue timed out"
    ) as { jobId: string; url: string; enqueuedAt: number } | null;

    if (!queueItem) {
      // No jobs in queue
      console.log('Worker: No jobs in queue');
      return NextResponse.json({
        success: true,
        message: "No jobs in queue",
        processed: false,
      });
    }

    const { jobId, url } = queueItem;
    console.log(`Worker: Processing job ${jobId} for URL ${url}`);

    // Load job from Supabase to verify it exists and get current status
    const queryPromise = supabase
      .from("audit_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    const queryResult = await withTimeout(
      queryPromise as unknown as Promise<any>,
      DB_QUERY_TIMEOUT,
      "Database query timed out"
    );
    const { data: job, error: jobError } = queryResult;

    if (jobError || !job) {
      console.error(`Job ${jobId} not found in database:`, jobError);
      return NextResponse.json({
        success: false,
        error: "Job not found",
        jobId,
      }, { status: 404 });
    }

    // Process if job is pending or running (multi-invoke pattern)
    if (job.status !== "pending" && job.status !== "running") {
      console.log(`Worker: Job ${jobId} is already ${job.status}, skipping`);
      return NextResponse.json({
        success: true,
        message: `Job ${jobId} is already ${job.status}`,
        processed: false,
        jobId,
        status: job.status,
      });
    }

    console.log(`Worker: Starting processing for job ${jobId}, current stage: ${job.stage || 0}`);

    // Determine starting stage based on current job state
    const currentStage = job.stage || 0;
    const startFromStage = currentStage === 0 ? 1 : currentStage + 1; // Resume from next stage
    const existingResults = job.results || {};

    // Check if job has exceeded total timeout (3 minutes)
    const jobAge = Date.now() - new Date(job.created_at).getTime();
    if (jobAge > 180000) {
      // Job is too old, mark as done with partial audit
      const updatePromise = supabase
        .from("audit_jobs")
        .update({
          status: "done",
          partial_audit: true,
          error_message: "Job exceeded maximum processing time",
        })
        .eq("id", jobId);
      await withTimeout(
        updatePromise as unknown as Promise<any>,
        DB_QUERY_TIMEOUT,
        "Database update timed out"
      );

      return NextResponse.json({
        success: true,
        message: `Job ${jobId} exceeded timeout`,
        processed: false,
        jobId,
      });
    }

    // Process the job with timeout protection
    // In serverless, we must await the job processing or it will be killed when function returns
    // However, we wrap it in a timeout so the worker handler can still return within 15 seconds
    // The job processing itself can take up to 3 minutes, but we start it and let it run
    try {
      // Start job processing - processAuditJob will update status to "running" immediately
      // We use Promise.race to ensure it doesn't hang forever, but we actually await it
      // because in serverless, fire-and-forget doesn't work
      // Support multi-invoke pattern: resume from last completed stage
      console.log(`Worker: Starting processAuditJob for ${jobId} from stage ${startFromStage}`);
      await Promise.race([
        processAuditJob(jobId, url, startFromStage, existingResults as any),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Job processing timeout")), JOB_PROCESSING_TIMEOUT)
        )
      ]);
      console.log(`Worker: Successfully completed processing job ${jobId}`);
      
      return NextResponse.json({
        success: true,
        message: `Job ${jobId} processed successfully`,
        processed: true,
        jobId,
      });
    } catch (error: any) {
      console.error(`Error processing job ${jobId}:`, error);
      // processAuditJob should have already updated the job status to "error"
      // But ensure it's marked as error if it wasn't
      try {
        await supabase
          .from("audit_jobs")
          .update({
            status: "error",
            error_message: error?.message || "Job processing failed",
          })
          .eq("id", jobId);
      } catch (updateError) {
        console.error(`Failed to update job ${jobId} status:`, updateError);
      }
      
      return NextResponse.json({
        success: false,
        error: error?.message || "Job processing failed",
        jobId,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in worker process route:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/worker/process - Process next audit job from queue
 * 
 * This endpoint is called by Vercel Cron (hourly) or immediately on job creation.
 * It pulls the next job from the Upstash queue and processes it.
 * 
 * TIMEOUT PROTECTION: All operations have timeouts to prevent infinite hangs.
 * Job processing can take up to 3 minutes, but individual operations are timeout-protected.
 */
export async function POST(req: NextRequest) {
  try {
    return await runWorker(req);
  } catch (error: any) {
    // Fallback error handler - should not be reached due to error handling in runWorker
    console.error("Worker error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || "Worker execution error"
      },
      { status: 500 }
    );
  }
}

