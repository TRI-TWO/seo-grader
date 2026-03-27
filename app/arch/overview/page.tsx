import { ArchShell } from "@/components/arch/arch-shell";
import { ArchPortalNotLinked } from "@/components/arch/arch-portal-not-linked";
import { getArchOverview } from "@/lib/arch/get-arch-overview";
import { getArchPortalGate } from "@/lib/arch/arch-portal-gate";
import { ArchOverviewBrandBlock } from "@/components/arch/arch-overview-brand-block";
import { ArchSeoPyramidCard } from "@/components/arch/arch-seo-pyramid-card";
import { ArchScoreCirclesCard } from "@/components/arch/arch-score-circles-card";
import { ArchCrmInteractionGrid } from "@/components/arch/arch-crm-interaction-grid";
import { ArchRenewalUpsellBar } from "@/components/arch/arch-renewal-upsell-bar";
import { ArchServiceTasksCard } from "@/components/arch/arch-service-tasks-card";
import { redirect } from "next/navigation";

export default async function ArchOverviewPage() {
  const gate = await getArchPortalGate();
  if (gate.kind === "unauthenticated") {
    redirect("/login");
  }
  if (gate.kind === "no_client") {
    return (
      <ArchShell title="Client Portal" subtitle="Account not linked">
        <ArchPortalNotLinked email={gate.user.email ?? null} />
      </ArchShell>
    );
  }

  const vm = await getArchOverview();
  if (!vm) {
    redirect("/login");
  }

  const subtitle = `${vm.clientName} · Client command center`;

  return (
    <ArchShell title="Client Portal" subtitle={subtitle}>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          <ArchOverviewBrandBlock
            clientName={vm.clientName}
            siteUrl={vm.siteUrl}
            lastUpdatedLabel={new Date(vm.lastUpdated).toLocaleString()}
          />
          <ArchSeoPyramidCard data={vm.seoPyramid} />
          <ArchScoreCirclesCard data={vm.scoreCircles} />
        </div>

        <div className="flex flex-col gap-6">
          <ArchCrmInteractionGrid data={vm.crmInteractionGrid} />
          <ArchRenewalUpsellBar data={vm.renewalUpsell} />
          <ArchServiceTasksCard data={vm.serviceTasks} />
        </div>
      </div>
    </ArchShell>
  );
}
