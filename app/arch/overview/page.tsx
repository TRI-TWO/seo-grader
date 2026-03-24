import { ArchShell } from "@/components/arch/arch-shell";
import { getArchOverview } from "@/lib/arch/get-arch-overview";
import { ArchHealthCard } from "@/components/arch/arch-health-card";
import { ArchMomentumCard } from "@/components/arch/arch-momentum-card";
import { ArchWhatWeDidCard } from "@/components/arch/arch-what-we-did-card";
import { ArchWhyItMattersCard } from "@/components/arch/arch-why-it-matters-card";
import { ArchNextStepsCard } from "@/components/arch/arch-next-steps-card";
import { ArchWaitingApprovalCard } from "@/components/arch/arch-waiting-approval-card";
import { ArchUpcomingTasksCard } from "@/components/arch/arch-upcoming-tasks-card";
import { ArchActivityFeedCard } from "@/components/arch/arch-activity-feed-card";
import { ArchRenewalCard } from "@/components/arch/arch-renewal-card";
import { redirect } from "next/navigation";

export default async function ArchOverviewPage() {
  const vm = await getArchOverview();
  if (!vm) {
    redirect("/login");
  }

  return (
    <ArchShell
      title="Client Portal"
      subtitle={`${vm.clientName} · ${vm.siteUrl} · Last updated ${new Date(vm.lastUpdated).toLocaleDateString()}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ArchHealthCard data={vm.healthCard} />
        <ArchMomentumCard data={vm.momentumCard} />
        <ArchWhatWeDidCard items={vm.whatWeDidItems} />
        <ArchWhyItMattersCard items={vm.whyItMattersItems} />
        <ArchNextStepsCard items={vm.nextFocusItems} />
        <ArchWaitingApprovalCard items={vm.approvalItems} />
        <ArchUpcomingTasksCard items={vm.upcomingTaskItems} />
        <ArchActivityFeedCard items={vm.activityFeedItems} />
        <ArchRenewalCard items={vm.renewalItems} />
      </div>
    </ArchShell>
  );
}

