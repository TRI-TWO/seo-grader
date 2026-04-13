import Link from "next/link";
import { redirect } from "next/navigation";
import { NewClientForm } from "@/components/admin/crm/NewClientForm";
import { isAdminEmail, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminNewClientPage() {
  const user = await requireAdmin();
  if (!user) {
    redirect("/login");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Admin CRM</p>
          <h1 className="mt-1 text-xl font-semibold text-white">New client</h1>
          <p className="mt-1 text-sm text-slate-400">
            Creates the Supabase account, org, and Arch client record. The client sets their password via{" "}
            <strong className="text-slate-300">Forgot password</strong> on first login.
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
        <NewClientForm />
      </div>
    </div>
  );
}
