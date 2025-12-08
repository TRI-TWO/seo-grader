import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { auditQueue } from "@/lib/auditQueue";
import { processAuditJob } from "@/lib/auditStages";
import "@/lib/auditWorker"; // Initialize worker

const prisma = new PrismaClient();

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

    // Check for existing job (single-flight + caching)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Check for running/pending job (single-flight)
    const existingRunning = await prisma.auditJob.findFirst({
      where: {
        url: targetUrl,
        status: {
          in: ["pending", "running"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingRunning) {
      return NextResponse.json({ jobId: existingRunning.id });
    }

    // Check for recently completed job (caching)
    const existingCompleted = await prisma.auditJob.findFirst({
      where: {
        url: targetUrl,
        status: "done",
        createdAt: {
          gte: oneDayAgo,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingCompleted) {
      return NextResponse.json({ jobId: existingCompleted.id });
    }

    // Create new job
    const jobId = uuidv4();
    const job = await prisma.auditJob.create({
      data: {
        id: jobId,
        url: targetUrl,
        status: "pending",
        stage: 0,
        results: null,
      },
    });

    // Enqueue for processing
    auditQueue.enqueue(jobId, targetUrl);

    return NextResponse.json({ jobId }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating audit job:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create audit job" },
      { status: 500 }
    );
  }
}

