import { NextRequest, NextResponse } from "next/server";
import { auditQueue } from "@/lib/auditQueue";
import { processAuditJob } from "@/lib/auditStages";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/worker/process - Process next audit job from queue
 * 
 * This endpoint is called by Vercel Cron (every 30-60 seconds) or manually.
 * It pulls the next job from the Upstash queue and processes it.
 */
export async function POST(req: NextRequest) {
  try {
    // Optional: Add authentication/authorization check here
    // For now, we'll allow it to be called by Vercel Cron

    // Dequeue next job
    const queueItem = await auditQueue.dequeue();

    if (!queueItem) {
      // No jobs in queue
      return NextResponse.json({
        success: true,
        message: "No jobs in queue",
        processed: false,
      });
    }

    const { jobId, url } = queueItem;

    // Load job from Supabase to verify it exists and get current status
    const { data: job, error: jobError } = await supabase
      .from("audit_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error(`Job ${jobId} not found in database:`, jobError);
      return NextResponse.json({
        success: false,
        error: "Job not found",
        jobId,
      }, { status: 404 });
    }

    // Only process if job is still pending
    if (job.status !== "pending") {
      return NextResponse.json({
        success: true,
        message: `Job ${jobId} is already ${job.status}`,
        processed: false,
        jobId,
        status: job.status,
      });
    }

    // Check if job has exceeded total timeout (3 minutes)
    const jobAge = Date.now() - new Date(job.created_at).getTime();
    if (jobAge > 180000) {
      // Job is too old, mark as done with partial audit
      await supabase
        .from("audit_jobs")
        .update({
          status: "done",
          partial_audit: true,
          error_message: "Job exceeded maximum processing time",
        })
        .eq("id", jobId);

      return NextResponse.json({
        success: true,
        message: `Job ${jobId} exceeded timeout`,
        processed: false,
        jobId,
      });
    }

    // Process the job (this will update status/stage as it progresses)
    try {
      await processAuditJob(jobId, url);
      return NextResponse.json({
        success: true,
        message: `Job ${jobId} processed successfully`,
        processed: true,
        jobId,
      });
    } catch (error: any) {
      console.error(`Error processing job ${jobId}:`, error);
      // processAuditJob should have already updated the job status to "error"
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

