import { ArchShell } from "@/components/arch/arch-shell";
import { ArchListCard } from "@/components/arch/arch-list-card";
import { getArchActivity } from "@/lib/arch/get-arch-activity";
import { redirect } from "next/navigation";

export default async function ArchActivityPage() {
  const vm = await getArchActivity();
  if (!vm) redirect("/login");

  return (
    <ArchShell title="Activity" subtitle="Service activity, chatbot interactions, and communication summaries.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ArchListCard title="Calls Handled" items={vm.callsHandled} />
        <ArchListCard title="Follow-up Emails" items={vm.followUpEmails} />
        <ArchListCard title="CRM Activity" items={vm.crmUpdates} />
        <ArchListCard title="Pending Items" items={vm.pendingItems} />
        <ArchListCard title="Next Planned Actions" items={vm.nextActions} />
      </div>
    </ArchShell>
  );
}

