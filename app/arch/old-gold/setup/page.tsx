import { ArchShell } from "@/components/arch/arch-shell";
import { ArchPortalNotLinked } from "@/components/arch/arch-portal-not-linked";
import { ArchQuestionnaireWizard } from "@/components/arch/old-gold-questionnaire/ArchQuestionnaireWizard";
import { getArchPortalGate } from "@/lib/arch/arch-portal-gate";
import { getClientForUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OldGoldSetupPage() {
  const gate = await getArchPortalGate();
  if (gate.kind === "unauthenticated") {
    redirect("/login?redirect=/arch/old-gold/setup");
  }
  if (gate.kind === "no_client") {
    return (
      <ArchShell title="OLD GOLD setup" subtitle="Account not linked">
        <ArchPortalNotLinked email={gate.user.email ?? null} />
      </ArchShell>
    );
  }

  const client = await getClientForUser(gate.user);
  if (!client) {
    redirect("/login?redirect=/arch/old-gold/setup");
  }

  return (
    <ArchShell
      title="OLD GOLD setup"
      subtitle="Onboarding questionnaire for your AI customer service bot"
    >
      <ArchQuestionnaireWizard clientId={client.id} />
    </ArchShell>
  );
}
