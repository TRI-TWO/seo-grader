"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/app/components/BrandLogo";
import LogoutButton from "@/app/components/LogoutButton";
import { createClient } from "@/lib/supabase/client";

function canUseCrmNav(email: string | null | undefined): boolean {
  return email === "mgr@tri-two.com" || email === "tri-two@mgr";
}

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [crmAdmin, setCrmAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) {
          setCrmAdmin(canUseCrmNav(user?.email));
        }
      } catch {
        if (!cancelled) setCrmAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const showCrmActions = pathname.startsWith("/admin") && crmAdmin;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050810] text-white">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(6,182,212,0.12),transparent_50%),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(59,130,246,0.06),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <div className="relative z-10">
        <header className="relative border-b border-cyan-500/10 bg-slate-950/70 backdrop-blur-md">
          <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-[25px] py-2">
            <div className="justify-self-start">
              <BrandLogo size={132} className="leading-none" />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-400/80">
                TRI-TWO
              </p>
              <h1 className="text-sm font-semibold tracking-wide text-white sm:text-base">
                Admin Portal
              </h1>
            </div>
            <div className="justify-self-end flex flex-wrap items-center justify-end gap-2">
              {showCrmActions ? (
                <>
                  <Link
                    href="/admin/crm/new-client"
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                  >
                    New Client +
                  </Link>
                  <Link
                    href="/admin/crm/remove-client"
                    className="rounded-lg border border-slate-600/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                  >
                    Remove Client −
                  </Link>
                </>
              ) : null}
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="relative">{children}</main>
      </div>
    </div>
  );
}

