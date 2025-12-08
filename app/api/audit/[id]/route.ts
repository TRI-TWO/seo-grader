import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Timeout constants
const DB_QUERY_TIMEOUT = 5000; // 5 seconds for database queries

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

    const queryPromise = supabase
      .from("audit_jobs")
      .select("*")
      .eq("id", id)
      .single();
    
    const queryResult = await withTimeout(
      queryPromise as unknown as Promise<any>,
      DB_QUERY_TIMEOUT,
      "Database query timed out"
    );
    const { data: job, error } = queryResult;

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
