"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/arch/overview", label: "Overview" },
  { href: "/arch/progress", label: "Progress" },
  { href: "/arch/activity", label: "Activity" },
  { href: "/arch/account", label: "Account" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/arch/overview") {
    return pathname === "/arch" || pathname.startsWith("/arch/overview");
  }
  return (
    pathname === href ||
    (href !== "/arch/activity" && pathname.startsWith(`${href}/`)) ||
    (href === "/arch/activity" && pathname.startsWith("/arch/activity"))
  );
}

export function ArchTopNav() {
  const pathname = usePathname() ?? "";
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <nav className="flex flex-wrap items-center justify-end gap-1.5">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${
              active
                ? "border border-cyan-500/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
                : "border border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 border border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/80 hover:text-white"
      >
        Log Out
      </button>
    </nav>
  );
}
