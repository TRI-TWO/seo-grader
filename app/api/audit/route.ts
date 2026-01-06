import { NextRequest, NextResponse } from "next/server";
import {
  processStage1Sync,
  processStage2Sync,
  processStage3Sync,
  type AuditResults,
} from "@/lib/auditStagesSync";
import { getCurrentUser, requireAdmin, isClient, canClientAccessAudit } from "@/lib/auth";
import { hasCapability, getUserPersona } from "@/lib/capabilities/check";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const HARD_TIMEOUT = 25000;

const US_STATES = [
  { name: "Alabama", abbr: "AL" },
  { name: "Alaska", abbr: "AK" },
  { name: "Arizona", abbr: "AZ" },
  { name: "Arkansas", abbr: "AR" },
  { name: "California", abbr: "CA" },
  { name: "Colorado", abbr: "CO" },
  { name: "Connecticut", abbr: "CT" },
  { name: "Delaware", abbr: "DE" },
  { name: "Florida", abbr: "FL" },
  { name: "Georgia", abbr: "GA" },
  { name: "Hawaii", abbr: "HI" },
  { name: "Idaho", abbr: "ID" },
  { name: "Illinois", abbr: "IL" },
  { name: "Indiana", abbr: "IN" },
  { name: "Iowa", abbr: "IA" },
  { name: "Kansas", abbr: "KS" },
  { name: "Kentucky", abbr: "KY" },
  { name: "Louisiana", abbr: "LA" },
  { name: "Maine", abbr: "ME" },
  { name: "Maryland", abbr: "MD" },
  { name: "Massachusetts", abbr: "MA" },
  { name: "Michigan", abbr: "MI" },
  { name: "Minnesota", abbr: "MN" },
  { name: "Mississippi", abbr: "MS" },
  { name: "Missouri", abbr: "MO" },
  { name: "Montana", abbr: "MT" },
  { name: "Nebraska", abbr: "NE" },
  { name: "Nevada", abbr: "NV" },
  { name: "New Hampshire", abbr: "NH" },
  { name: "New Jersey", abbr: "NJ" },
  { name: "New Mexico", abbr: "NM" },
  { name: "New York", abbr: "NY" },
  { name: "North Carolina", abbr: "NC" },
  { name: "North Dakota", abbr: "ND" },
  { name: "Ohio", abbr: "OH" },
  { name: "Oklahoma", abbr: "OK" },
  { name: "Oregon", abbr: "OR" },
  { name: "Pennsylvania", abbr: "PA" },
  { name: "Rhode Island", abbr: "RI" },
  { name: "South Carolina", abbr: "SC" },
  { name: "South Dakota", abbr: "SD" },
  { name: "Tennessee", abbr: "TN" },
  { name: "Texas", abbr: "TX" },
  { name: "Utah", abbr: "UT" },
  { name: "Vermont", abbr: "VT" },
  { name: "Virginia", abbr: "VA" },
  { name: "Washington", abbr: "WA" },
  { name: "West Virginia", abbr: "WV" },
  { name: "Wisconsin", abbr: "WI" },
  { name: "Wyoming", abbr: "WY" },
];

export async function POST(req: NextRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HARD_TIMEOUT);

  try {
    console.log("AUDIT: ENTERED ROUTE");

    // Check if user is logged in and has capability (optional - public audits allowed)
    const user = await getCurrentUser();
    if (user) {
      // Admin users (mgr@tri-two.com) always have permission
      const isAdmin = await requireAdmin();
      if (!isAdmin) {
        // Check if user is a client
        const userIsClient = await isClient(user);
        
        if (userIsClient) {
          // Clients can only access audit if allow_audit_free_access = true
          const canAccess = await canClientAccessAudit(user);
          if (!canAccess) {
            clearTimeout(timeoutId);
            return NextResponse.json(
              { error: 'Free audit access is not enabled for your account.' },
              { status: 403 }
            );
          }
        } else {
          // Non-client, non-admin users need capability
          const hasAuditCapability = await hasCapability(user.id, 'run_audit');
          if (!hasAuditCapability) {
            clearTimeout(timeoutId);
            return NextResponse.json(
              { error: 'You do not have permission to run audits. Please upgrade your subscription.' },
              { status: 403 }
            );
          }
        }
      }
    }

    const { url } = await req.json();
    console.log("AUDIT: AFTER BODY PARSE", url);

    const stage1 = await processStage1Sync(url);
    console.log("AUDIT: AFTER STAGE 1", stage1.status);

    const stage2 = await processStage2Sync(stage1, US_STATES);
    console.log("AUDIT: AFTER STAGE 2", stage2.seoScore);

    const stage3 = await processStage3Sync(stage2);
    console.log("AUDIT: AFTER STAGE 3", stage3.aiScoreRaw);

    // Store in llm_runs if user is logged in
    if (user) {
      const persona = await getUserPersona(user.id);
      const supabase = createClient();
      try {
        await supabase.from('llm_runs').insert({
          user_id: user.id,
          persona: persona || 'wildcat',
          tool: 'audit',
          input: { url },
          output: stage3,
          visibility: persona === 'smokey' ? 'internal' : 'client',
        });
      } catch (err) {
        console.error('Error storing audit run:', err);
        // Don't fail the request if storage fails
      }
    }

    // Create signal from audit results (Audit is fact generator - emits signals)
    // Find client by URL if possible, otherwise signal will be created without clientId
    let clientId: string | null = null;
    if (user) {
      try {
        const { prisma } = await import('@/lib/prisma');
        const client = await prisma.client.findFirst({
          where: { canonicalUrl: url },
        });
        if (client) {
          clientId = client.id;
          const { createAuditSignal } = await import('@/lib/smokey/signals');
          const { logEvent } = await import('@/lib/smokey/events');
          await createAuditSignal(clientId, stage3, { url, userId: user.id });
          await logEvent(clientId, 'signal_detected', 'signal', null, {
            signalType: 'audit_result',
            source: 'audit',
          });
        }
      } catch (err) {
        console.error('Error creating audit signal:', err);
        // Don't fail the request if signal creation fails
      }
    }

    clearTimeout(timeoutId);
    return NextResponse.json({ results: stage3 });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("AUDIT: ERROR", error?.message || error);
    return NextResponse.json(
      { success: false, error: "Audit failed" },
      { status: 500 }
    );
  }
}
