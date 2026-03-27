import { ArchShell } from "@/components/arch/arch-shell";
import { ArchPortalNotLinked } from "@/components/arch/arch-portal-not-linked";
import { ArchCard } from "@/components/arch/arch-card";
import { getArchOverview } from "@/lib/arch/get-arch-overview";
import { getArchPortalGate } from "@/lib/arch/arch-portal-gate";
import { redirect } from "next/navigation";

export default async function ArchAccountPage() {
  const gate = await getArchPortalGate();
  if (gate.kind === "unauthenticated") redirect("/login");
  if (gate.kind === "no_client") {
    return (
      <ArchShell title="Account" subtitle="Account not linked">
        <ArchPortalNotLinked email={gate.user.email ?? null} />
      </ArchShell>
    );
  }

  const vm = await getArchOverview();
  if (!vm) redirect("/login");

  return (
    <ArchShell title="Account" subtitle="Managed properties, package details, and support touchpoints.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ArchCard title="Managed Site">{vm.siteUrl}</ArchCard>
        <ArchCard title="Current Package">{vm.serviceTier}</ArchCard>
        <ArchCard title="Support Contact">TRI-TWO Client Success Team</ArchCard>
        <ArchCard title="Last Report Update">{new Date(vm.lastUpdated).toLocaleString()}</ArchCard>
        <ArchCard title="Approvals">Approval workflow placeholder</ArchCard>
        <ArchCard title="Billing / Renewal">Renewal placeholder</ArchCard>
      </div>
    </ArchShell>
  );
}

