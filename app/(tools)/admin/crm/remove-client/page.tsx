import Link from "next/link";
import { redirect } from "next/navigation";
import { RemoveClientTable } from "@/components/admin/crm/RemoveClientTable";
import { isAdminEmail, requireAdmin } from "@/lib/auth";
import { listPortalClients } from "@/lib/admin/crm/portalClientService";

export const dynamic = "force-dynamic";

export default async function AdminRemoveClientPage() {
  const user = await requireAdmin();
  if (!user) {
    redirect("/login");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/");
  }

  const clients = await listPortalClients();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Admin CRM</p>
          <h1 className="mt-1 text-xl font-semibold text-white">Remove clients</h1>
          <p className="mt-1 text-sm text-slate-400">
            Select one or more portal clients, confirm, and deactivate their access (soft delete).
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-lg border border-slate-600/80 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900/60"
        >
          Back to Admin
        </Link>
      </div>

      <div className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-slate-900/90 to-slate-950/95 p-6 shadow-[0_0_0_1px_rgba(6,182,212,0.06)]">
        <RemoveClientTable initialClients={clients} />
      </div>
    </div>
  );
}
