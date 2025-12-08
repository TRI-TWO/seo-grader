import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auditQueue } from "@/lib/auditQueue";
import { supabase } from "@/lib/supabase";
import { checkRateLimit, acquireLock, releaseLock } from "@/lib/upstash";

export const runtime = "nodejs";

// Timeout constants
const API_TIMEOUT = 10000; // 10 seconds for API operations
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
 * POST /api/audit - Enqueue an audit job
 * 
 * Returns quickly with a jobId. The actual scraping happens in the background.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid url parameter" },
        { status: 400 }
      );
    }

    // Normalize URL
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      );
    }

    // Rate limiting: Check anonymous user rate limit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || 
               req.headers.get("x-real-ip") || 
               "unknown";
    const rateLimit = await withTimeout(
      checkRateLimit(ip),
      API_TIMEOUT,
      "Rate limit check timed out"
    ) as { allowed: boolean; remaining: number; resetAt: number };
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
          resetAt: rateLimit.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetAt.toString(),
            "Retry-After": Math.ceil((rateLimit.resetAt - Math.floor(Date.now() / 1000))).toString(),
          },
        }
      );
    }

    // Single-flight locking: Try to acquire lock for this URL
    const lockAcquired = await withTimeout(
      acquireLock(targetUrl),
      API_TIMEOUT,
      "Lock acquisition timed out"
    );
    if (!lockAcquired) {
      // Another request is processing this URL, check for existing job
      const queryPromise = supabase
        .from("audit_jobs")
        .select("id")
        .eq("url", targetUrl)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const queryResult = await withTimeout(
        queryPromise as unknown as Promise<any>,
        DB_QUERY_TIMEOUT,
        "Database query timed out"
      );
      const existingRunning = queryResult.data;

      if (existingRunning) {
        return NextResponse.json({ jobId: existingRunning.id });
      }
      // If no job found but lock exists, wait a bit and retry or return error
      return NextResponse.json(
        { error: "Request already in progress for this URL" },
        { status: 409 }
      );
    }

    try {
      // Check for running/pending job with same URL (double-check after acquiring lock)
      const queryPromise1 = supabase
        .from("audit_jobs")
        .select("id")
        .eq("url", targetUrl)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const queryResult1 = await withTimeout(
        queryPromise1 as unknown as Promise<any>,
        DB_QUERY_TIMEOUT,
        "Database query timed out"
      );
      const existingRunning = queryResult1.data;

      if (existingRunning) {
        await withTimeout(
          releaseLock(targetUrl),
          API_TIMEOUT,
          "Lock release timed out"
        );
        return NextResponse.json({ jobId: existingRunning.id });
      }

      // 24h caching: Check for recently completed job
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const queryPromise2 = supabase
      .from("audit_jobs")
      .select("id")
      .eq("url", targetUrl)
      .eq("status", "done")
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const queryResult2 = await withTimeout(
      queryPromise2 as unknown as Promise<any>,
      DB_QUERY_TIMEOUT,
      "Database query timed out"
    );
    const existingCompleted = queryResult2.data;

      if (existingCompleted) {
        await withTimeout(
          releaseLock(targetUrl),
          API_TIMEOUT,
          "Lock release timed out"
        );
        return NextResponse.json({ jobId: existingCompleted.id });
      }

    // Create new job
    const jobId = uuidv4();
    const insertPromise = supabase
      .from("audit_jobs")
      .insert({
        id: jobId,
        url: targetUrl,
        status: "pending",
        stage: 0,
        results: null,
      })
      .select()
      .single();
    const { data: job, error: insertError } = await withTimeout(
      insertPromise as unknown as Promise<any>,
      DB_QUERY_TIMEOUT,
      "Database query timed out"
    );

    if (insertError || !job) {
      console.error("Error creating audit job:", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Failed to create audit job" },
        { status: 500 }
      );
    }

      // Enqueue for processing
      await withTimeout(
        auditQueue.enqueue(jobId, targetUrl),
        API_TIMEOUT,
        "Queue enqueue timed out"
      );

      // Release lock after enqueueing
      await withTimeout(
        releaseLock(targetUrl),
        API_TIMEOUT,
        "Lock release timed out"
      );

      return NextResponse.json(
        { jobId },
        {
          status: 201,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.resetAt.toString(),
          },
        }
      );
    } catch (error) {
      // Release lock on error (with timeout protection)
      try {
        await withTimeout(
          releaseLock(targetUrl),
          API_TIMEOUT,
          "Lock release timed out"
        );
      } catch (releaseError) {
        console.error("Error releasing lock:", releaseError);
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error creating audit job:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create audit job" },
      { status: 500 }
    );
  }
}
