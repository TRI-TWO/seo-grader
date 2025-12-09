import { NextRequest, NextResponse } from "next/server";
import { processStage1Sync, processStage2Sync, processStage3Sync } from "@/lib/auditStages";

export const runtime = "nodejs";

// Timeout constants
const HARD_TIMEOUT = 25000; // 25 seconds max for entire request

// US States data (inline for synchronous execution)
const US_STATES = [
  { name: 'Alabama', abbr: 'AL' },
  { name: 'Alaska', abbr: 'AK' },
  { name: 'Arizona', abbr: 'AZ' },
  { name: 'Arkansas', abbr: 'AR' },
  { name: 'California', abbr: 'CA' },
  { name: 'Colorado', abbr: 'CO' },
  { name: 'Connecticut', abbr: 'CT' },
  { name: 'Delaware', abbr: 'DE' },
  { name: 'Florida', abbr: 'FL' },
  { name: 'Georgia', abbr: 'GA' },
  { name: 'Hawaii', abbr: 'HI' },
  { name: 'Idaho', abbr: 'ID' },
  { name: 'Illinois', abbr: 'IL' },
  { name: 'Indiana', abbr: 'IN' },
  { name: 'Iowa', abbr: 'IA' },
  { name: 'Kansas', abbr: 'KS' },
  { name: 'Kentucky', abbr: 'KY' },
  { name: 'Louisiana', abbr: 'LA' },
  { name: 'Maine', abbr: 'ME' },
  { name: 'Maryland', abbr: 'MD' },
  { name: 'Massachusetts', abbr: 'MA' },
  { name: 'Michigan', abbr: 'MI' },
  { name: 'Minnesota', abbr: 'MN' },
  { name: 'Mississippi', abbr: 'MS' },
  { name: 'Missouri', abbr: 'MO' },
  { name: 'Montana', abbr: 'MT' },
  { name: 'Nebraska', abbr: 'NE' },
  { name: 'Nevada', abbr: 'NV' },
  { name: 'New Hampshire', abbr: 'NH' },
  { name: 'New Jersey', abbr: 'NJ' },
  { name: 'New Mexico', abbr: 'NM' },
  { name: 'New York', abbr: 'NY' },
  { name: 'North Carolina', abbr: 'NC' },
  { name: 'North Dakota', abbr: 'ND' },
  { name: 'Ohio', abbr: 'OH' },
  { name: 'Oklahoma', abbr: 'OK' },
  { name: 'Oregon', abbr: 'OR' },
  { name: 'Pennsylvania', abbr: 'PA' },
  { name: 'Rhode Island', abbr: 'RI' },
  { name: 'South Carolina', abbr: 'SC' },
  { name: 'South Dakota', abbr: 'SD' },
  { name: 'Tennessee', abbr: 'TN' },
  { name: 'Texas', abbr: 'TX' },
  { name: 'Utah', abbr: 'UT' },
  { name: 'Vermont', abbr: 'VT' },
  { name: 'Virginia', abbr: 'VA' },
  { name: 'Washington', abbr: 'WA' },
  { name: 'West Virginia', abbr: 'WV' },
  { name: 'Wisconsin', abbr: 'WI' },
  { name: 'Wyoming', abbr: 'WY' },
];

/**
 * POST /api/audit - Execute full audit synchronously
 * 
 * Executes all 3 stages immediately and returns results directly.
 * No job creation, no queue, no database persistence.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
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

    // Execute all stages synchronously with hard timeout
    const auditPromise = (async () => {
      try {
        // Stage 1: Fast Pass - Basic audit data
        const stage1Results = await processStage1Sync(targetUrl);
        
        // Check if we've exceeded timeout
        if (Date.now() - startTime > HARD_TIMEOUT) {
          return {
            ...stage1Results,
            partialAudit: true,
          };
        }

        // If Stage 1 returned partial audit (blocked site), return early
        if (stage1Results.partialAudit) {
          return stage1Results;
        }

        // Stage 2: Structure + Media
        const stage2Results = await processStage2Sync(stage1Results, US_STATES);
        
        // Check if we've exceeded timeout
        if (Date.now() - startTime > HARD_TIMEOUT) {
          return {
            ...stage2Results,
            partialAudit: true,
          };
        }

        // Stage 3: AI Optimization
        const finalResults = await processStage3Sync(stage2Results);
        
        return finalResults;
      } catch (error: any) {
        console.error("Error during audit execution:", error);
        // Return partial results with error
        return {
          url: targetUrl,
          finalUrl: targetUrl,
          status: 0,
          partialAudit: true,
        };
      }
    })();

    // Race against hard timeout
    const results = await Promise.race([
      auditPromise,
      new Promise<typeof auditPromise extends Promise<infer T> ? T : never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout - audit exceeded maximum time")), HARD_TIMEOUT)
      ),
    ]).catch((error) => {
      console.error("Audit timeout or error:", error);
      return {
        url: targetUrl,
        finalUrl: targetUrl,
        status: 0,
        partialAudit: true,
      };
    });

    // Return results directly
    console.log("API returning results:", {
      hasResults: !!results,
      hasSeoScore: !!results?.seoScore,
      hasTitleScore: !!results?.titleScoreRaw,
      hasMediaScore: !!results?.mediaScoreRaw,
      hasAiScore: !!results?.aiScoreRaw,
      partialAudit: results?.partialAudit,
    });
    
    return NextResponse.json(
      { results },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in audit API route:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process audit" },
      { status: 500 }
    );
  }
}
