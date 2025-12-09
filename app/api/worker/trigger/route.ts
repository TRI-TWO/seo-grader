import { NextRequest, NextResponse } from "next/server";
import { auditQueue } from "@/lib/auditQueue";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/worker/trigger - Manually trigger worker to process next job
 * 
 * This is a backup endpoint to manually trigger job processing.
 * Useful when the automatic trigger fails.
 * 
 * Can be called via:
 * - Browser: https://your-app.vercel.app/api/worker/trigger
 * - Cron: Add to vercel.json crons
 * - Manual: curl https://your-app.vercel.app/api/worker/trigger
 */
export async function GET(req: NextRequest) {
  try {
    // Check for worker secret (optional, for security)
    const secret = req.headers.get('x-worker-secret');
    const workerSecret = process.env.WORKER_SECRET;

    if (workerSecret && secret !== workerSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get base URL for worker process endpoint
    const requestUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      `${requestUrl.protocol}//${requestUrl.host}`;
    
    console.log(`Manual trigger: Calling worker at ${baseUrl}/api/worker/process`);

    // Call the worker process endpoint
    const response = await fetch(`${baseUrl}/api/worker/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(workerSecret ? { 'x-worker-secret': workerSecret } : {}),
      },
    });

    const result = await response.json();

    return NextResponse.json({
      success: response.ok,
      message: "Worker triggered",
      workerResponse: result,
      status: response.status,
    });
  } catch (error: any) {
    console.error("Error triggering worker:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to trigger worker",
      },
      { status: 500 }
    );
  }
}

