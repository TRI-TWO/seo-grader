import { NextRequest, NextResponse } from "next/server";
import { auditQueue } from "@/lib/auditQueue";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/worker/queue-status - Check queue status and pending jobs
 * 
 * Useful for debugging queue issues
 */
export async function GET(req: NextRequest) {
  try {
    // Get queue length
    const queueLength = await auditQueue.getLength();
    
    // Get pending jobs from database
    const { data: pendingJobs, error } = await supabase
      .from("audit_jobs")
      .select("id, url, status, stage, created_at, updated_at")
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(10);

    // Get recent jobs
    const { data: recentJobs } = await supabase
      .from("audit_jobs")
      .select("id, url, status, stage, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      queueLength,
      pendingJobs: pendingJobs || [],
      recentJobs: recentJobs || [],
      error: error?.message,
    });
  } catch (error: any) {
    console.error("Error getting queue status:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to get queue status",
      },
      { status: 500 }
    );
  }
}

