import { ArchShell } from "@/components/arch/arch-shell";
import { ArchPortalNotLinked } from "@/components/arch/arch-portal-not-linked";
import { ArchListCard } from "@/components/arch/arch-list-card";
import { getArchActivity } from "@/lib/arch/get-arch-activity";
import { getArchPortalGate } from "@/lib/arch/arch-portal-gate";
import {
  ARCH_CRM_SEGMENTS,
  isArchCrmActivitySegment,
} from "@/lib/arch/client-types";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ crm?: string }>;
};

const crmLabels: Record<(typeof ARCH_CRM_SEGMENTS)[number], string> = {
  "follow-up-calls": "Follow-up calls",
  "incoming-calls": "Incoming calls",
  meetings: "Meetings",
  bids: "Bids",
};

export default async function ArchActivityPage({ searchParams }: Props) {
  const { crm } = await searchParams;
  if (crm && isArchCrmActivitySegment(crm)) {
    redirect(`/arch/activity/${crm}`);
  }

  const gate = await getArchPortalGate();
  if (gate.kind === "unauthenticated") redirect("/login");
  if (gate.kind === "no_client") {
    return (
      <ArchShell title="Activity" subtitle="Account not linked">
        <ArchPortalNotLinked email={gate.user.email ?? null} />
      </ArchShell>
    );
  }

  const vm = await getArchActivity();
  if (!vm) redirect("/login");

  return (
    <ArchShell
      title="Activity"
      subtitle="Service activity, chatbot interactions, and communication summaries."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {ARCH_CRM_SEGMENTS.map((key) => (
          <Link
            key={key}
            href={`/arch/activity/${key}`}
            className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-500/35 hover:text-cyan-100"
          >
            {crmLabels[key]}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ArchListCard title="Calls Handled" items={vm.callsHandled} />
        <ArchListCard title="Follow-up Emails" items={vm.followUpEmails} />
        <ArchListCard title="CRM Activity" items={vm.crmUpdates} />
        <ArchListCard title="Pending Items" items={vm.pendingItems} />
        <ArchListCard title="Next Planned Actions" items={vm.nextActions} />
      </div>
    </ArchShell>
  );
}
