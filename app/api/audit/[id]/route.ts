import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/audit/[id] - Get audit job status and results
 * 
 * Returns the current status, stage, and results (if available).
 * Frontend polls this endpoint to check job progress.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing job ID" },
        { status: 400 }
      );
    }

    const { data: job, error } = await supabase
      .from("audit_jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      jobId: job.id,
      url: job.url,
      status: job.status,
      stage: job.stage,
      results: job.results,
      errorMessage: job.error_message || undefined,
      partialAudit: job.partial_audit || false,
    });
  } catch (error: any) {
    console.error("Error fetching audit job:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch audit job" },
      { status: 500 }
    );
  }
}
