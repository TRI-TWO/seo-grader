import { ArchShell } from "@/components/arch/arch-shell";
import { ArchPortalNotLinked } from "@/components/arch/arch-portal-not-linked";
import { ArchHealthCard } from "@/components/arch/arch-health-card";
import { ArchListCard } from "@/components/arch/arch-list-card";
import { ArchBeforeAfterCard } from "@/components/arch/arch-before-after-card";
import { getArchProgress } from "@/lib/arch/get-arch-progress";
import { getArchPortalGate } from "@/lib/arch/arch-portal-gate";
import { redirect } from "next/navigation";

export default async function ArchProgressPage() {
  const gate = await getArchPortalGate();
  if (gate.kind === "unauthenticated") redirect("/login");
  if (gate.kind === "no_client") {
    return (
      <ArchShell title="Progress" subtitle="Account not linked">
        <ArchPortalNotLinked email={gate.user.email ?? null} />
      </ArchShell>
    );
  }

  const vm = await getArchProgress();
  if (!vm) redirect("/login");

  return (
    <ArchShell title="Progress" subtitle="What improved, what is lagging, and what comes next.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ArchHealthCard data={vm.healthCard} />
        <ArchListCard title="Improvements Made" items={vm.improvements} />
        <ArchListCard title="Lagging Areas" items={vm.laggingAreas} />
        <ArchListCard title="Trust Signals" items={vm.trustSignals} />
        <ArchBeforeAfterCard items={vm.beforeAfter} />
      </div>
    </ArchShell>
  );
}

