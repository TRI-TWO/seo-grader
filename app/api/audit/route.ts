import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auditQueue } from "@/lib/auditQueue";
import { supabase } from "@/lib/supabase";
import { redis } from "@/lib/upstash";

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

    // Single-flight locking: Check for running/pending job with same URL
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

    return NextResponse.json({ jobId }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating audit job:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create audit job" },
      { status: 500 }
    );
  }
}
