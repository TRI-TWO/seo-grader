import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auditQueue } from "@/lib/auditQueue";
import { supabase } from "@/lib/supabase";
import { checkRateLimit, acquireLock, releaseLock } from "@/lib/upstash";

export const runtime = "nodejs";

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
    const rateLimit = await checkRateLimit(ip);
    
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
    const lockAcquired = await acquireLock(targetUrl);
    if (!lockAcquired) {
      // Another request is processing this URL, check for existing job
      const { data: existingRunning } = await supabase
        .from("audit_jobs")
        .select("id")
        .eq("url", targetUrl)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

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
      const { data: existingRunning } = await supabase
        .from("audit_jobs")
        .select("id")
        .eq("url", targetUrl)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingRunning) {
        await releaseLock(targetUrl);
        return NextResponse.json({ jobId: existingRunning.id });
      }

      // 24h caching: Check for recently completed job
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingCompleted } = await supabase
      .from("audit_jobs")
      .select("id")
      .eq("url", targetUrl)
      .eq("status", "done")
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

      if (existingCompleted) {
        await releaseLock(targetUrl);
        return NextResponse.json({ jobId: existingCompleted.id });
      }

    // Create new job
    const jobId = uuidv4();
    const { data: job, error: insertError } = await supabase
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

    if (insertError || !job) {
      console.error("Error creating audit job:", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Failed to create audit job" },
        { status: 500 }
      );
    }

      // Enqueue for processing
      await auditQueue.enqueue(jobId, targetUrl);

      // Release lock after enqueueing
      await releaseLock(targetUrl);

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
      // Release lock on error
      await releaseLock(targetUrl);
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
