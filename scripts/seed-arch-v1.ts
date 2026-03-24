import { prisma } from "../lib/prisma";
import { PlanTier, ClientStatus } from "@prisma/client";

async function seedArchV1() {
  const client = await prisma.client.upsert({
    where: { email: "mjhanratty18@gmail.com" },
    update: {
      companyName: "TRI-TWO",
      canonicalUrl: "https://tri-two.com",
      planTier: PlanTier.growth,
      status: ClientStatus.ACTIVE,
    },
    create: {
      email: "mjhanratty18@gmail.com",
      companyName: "TRI-TWO",
      canonicalUrl: "https://tri-two.com",
      planTier: PlanTier.growth,
      status: ClientStatus.ACTIVE,
      contractStartDate: new Date(),
      contractLengthMonths: 12,
      allow_audit_free_access: true,
    },
  });

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO arch_client_outputs (
      client_id,
      site_id,
      month_key,
      health_score,
      health_status,
      health_direction,
      summary,
      what_we_did_json,
      why_it_matters_json,
      what_next_json,
      trust_signals_json,
      before_after_json,
      activity_summary_json,
      waiting_approval_json,
      upcoming_tasks_json,
      renewal_updates_json,
      source_meta_json
    )
    VALUES
      ($1, 'tri-two.com', '2026-02', 68, 'warning', 'flat', $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, '{}'::jsonb),
      ($1, 'tri-two.com', '2026-03', 74, 'good', 'improving', $12, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb, '{}'::jsonb)
    ON CONFLICT (client_id, month_key) DO UPDATE
    SET
      health_score = EXCLUDED.health_score,
      health_status = EXCLUDED.health_status,
      health_direction = EXCLUDED.health_direction,
      summary = EXCLUDED.summary,
      what_we_did_json = EXCLUDED.what_we_did_json,
      why_it_matters_json = EXCLUDED.why_it_matters_json,
      what_next_json = EXCLUDED.what_next_json,
      trust_signals_json = EXCLUDED.trust_signals_json,
      before_after_json = EXCLUDED.before_after_json,
      activity_summary_json = EXCLUDED.activity_summary_json,
      waiting_approval_json = EXCLUDED.waiting_approval_json,
      upcoming_tasks_json = EXCLUDED.upcoming_tasks_json,
      renewal_updates_json = EXCLUDED.renewal_updates_json,
      updated_at = now()
  `,
    client.id,
    "We are building stronger local visibility while improving conversion paths and trust.",
    JSON.stringify([
      { title: "Homepage structure updated", detail: "Clarified services and added stronger conversion flow." },
      { title: "Internal linking improved", detail: "Connected key service sections to improve crawl and context." },
      { title: "Trust signals expanded", detail: "Added proof points and stronger credibility sections." },
    ]),
    JSON.stringify([
      { title: "Search engines understand your services better", detail: "Improved structure helps ranking clarity." },
      { title: "Visitors reach key actions faster", detail: "Cleaner paths reduce friction to contact." },
      { title: "Trust improved on-page confidence", detail: "More proof points support conversion decisions." },
    ]),
    JSON.stringify([
      { title: "Expand high-intent FAQ coverage", detail: "Address remaining top customer questions." },
      { title: "Improve local service area clarity", detail: "Strengthen city references inside hub pages." },
      { title: "Refine conversion CTAs", detail: "Improve contact prompts on high-traffic sections." },
    ]),
    JSON.stringify([
      { title: "Licensing and credential blocks", detail: "Visible and structured for easier trust validation." },
      { title: "Customer proof snippets", detail: "Added in high-visibility sections." },
    ]),
    JSON.stringify([
      { title: "Before: broad headline", detail: "After: clear service + locality message with direct CTA." },
    ]),
    JSON.stringify([
      { title: "Calls handled", detail: "12 client inquiries supported this week." },
      { title: "Follow-up emails", detail: "9 follow-ups sent for open leads." },
      { title: "Chatbot interactions", detail: "38 sessions resolved common service questions." },
      { title: "CRM updates", detail: "14 lead records updated with latest status." },
      { title: "Client communication", detail: "Weekly summary delivered with action notes." },
    ]),
    JSON.stringify([
      { title: "Approve revised services section", detail: "Final content sign-off needed." },
      { title: "Approve testimonial placement", detail: "Confirm highlighted proof sections." },
    ]),
    JSON.stringify([
      { title: "FAQ expansion", detail: "Publish 3 high-intent questions this week." },
      { title: "Local hub refinement", detail: "Strengthen service area structure for top cities." },
      { title: "Conversion QA", detail: "Validate contact path from mobile sessions." },
    ]),
    JSON.stringify([
      { title: "Package renewal window", detail: "Renewal review starts next month." },
    ]),
    "SEO and service activity trend is improving with stronger structure and trust visibility.",
    JSON.stringify([
      { title: "Technical cleanup completed", detail: "Resolved crawl blockers impacting visibility." },
      { title: "Content clarity improved", detail: "Refined service messaging for stronger intent match." },
      { title: "Activity reporting live", detail: "Client-safe CRM and chatbot summaries now available." },
    ]),
    JSON.stringify([
      { title: "Higher qualified search traffic potential", detail: "Better intent alignment improves click quality." },
      { title: "More consistent conversion flow", detail: "Clearer paths reduce drop-off to contact." },
      { title: "Stronger client confidence", detail: "Visible progress and proof support retention." },
    ]),
    JSON.stringify([
      { title: "Local authority layer rollout", detail: "Begin maps and GBP tracking cadence." },
      { title: "Expand trust section depth", detail: "Add additional proof and service credentials." },
      { title: "Refine handoff automation", detail: "Improve service activity reporting quality." },
    ]),
    JSON.stringify([
      { title: "Structured trust module", detail: "Improved credibility signals across core pages." },
      { title: "Review highlights surfaced", detail: "Positive customer proof now easier to scan." },
    ]),
    JSON.stringify([
      { title: "Before: limited trust placement", detail: "After: trust indicators now visible near decision points." },
    ]),
    JSON.stringify([
      { title: "Calls handled", detail: "16 interactions resolved or routed." },
      { title: "Follow-up emails", detail: "11 client-safe updates sent." },
      { title: "Chatbot interactions", detail: "45 sessions captured and summarized." },
      { title: "CRM updates", detail: "19 records refreshed with current outcomes." },
      { title: "Upcoming milestones", detail: "Next sprint plan prepared for approval." },
    ]),
    JSON.stringify([
      { title: "Approve local keyword set", detail: "Confirm priority city/service pairs." },
      { title: "Approve next content sprint", detail: "Sign-off needed to schedule publish queue." },
    ]),
    JSON.stringify([
      { title: "Maps ranking baseline", detail: "Record first 3-5 keyword snapshots." },
      { title: "GBP profile checks", detail: "Validate category and completeness metrics." },
      { title: "Service hub QA", detail: "Finalize city anchor sections in primary hubs." },
    ]),
    JSON.stringify([
      { title: "Renewal and upsell preview", detail: "AI customer service lane and SEO expansion review due." },
    ])
  );

  console.log("Arch v1 seed complete for:", client.email);
  console.log("Admin identity must exist in Supabase Auth: tri-two@mgr");
}

seedArchV1()
  .catch((error) => {
    console.error("Failed to seed Arch v1:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

