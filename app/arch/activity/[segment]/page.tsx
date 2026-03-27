import { ArchShell } from "@/components/arch/arch-shell";
import { ArchPortalNotLinked } from "@/components/arch/arch-portal-not-linked";
import { getArchActivityDrillDown } from "@/lib/arch/get-arch-activity";
import { getArchPortalGate } from "@/lib/arch/arch-portal-gate";
import { isArchCrmActivitySegment } from "@/lib/arch/client-types";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ segment: string }>;
};

export default async function ArchActivitySegmentPage({ params }: Props) {
  const { segment } = await params;
  if (!isArchCrmActivitySegment(segment)) {
    notFound();
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

  const drill = await getArchActivityDrillDown(segment);
  if (!drill) redirect("/login");

  return (
    <ArchShell
      title={drill.segmentTitle}
      subtitle="Contact and follow-up details from your activity stream."
    >
      <div className="mb-6">
        <Link
          href="/arch/activity"
          className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
        >
          ← All activity
        </Link>
      </div>

      {drill.rows.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
          No events in this category yet. As your chatbot and CRM feed data in,
          records will appear here.
        </p>
      ) : (
        <ul className="space-y-4">
          {drill.rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-white">
                  {row.contactName}
                </span>
                {row.occurredAt ? (
                  <span className="text-xs text-slate-500">
                    {new Date(row.occurredAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                Client
              </p>
              <p className="text-sm text-slate-300">{row.clientName}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-sm text-slate-200">{row.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm text-slate-200">{row.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="text-sm text-slate-200">{row.location}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    Project / service type
                  </p>
                  <p className="text-sm text-slate-200">{row.serviceType}</p>
                </div>
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-500">Summary</p>
                <p className="text-sm text-slate-300">{row.summaryNotes}</p>
              </div>
              <div className="mt-3">
                <p className="text-xs text-slate-500">Follow-up notes</p>
                <p className="text-sm text-slate-300">{row.followUpNotes}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ArchShell>
  );
}
