import type { ReactNode } from "react";
import BrandLogo from "@/app/components/BrandLogo";
import { ArchTopNav } from "./arch-top-nav";

type ArchShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ArchShell({ title, subtitle, children }: ArchShellProps) {
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

      <header className="relative border-b border-cyan-500/10 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-[25px] py-2">
          <div className="justify-self-start">
            <BrandLogo size={126} className="leading-none" />
          </div>
          <div className="min-w-0 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400/85">
              TRI-TWO
            </div>
            <h1 className="mt-0.5 text-base font-bold tracking-tight text-white sm:text-lg">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-400 line-clamp-1 sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="justify-self-end">
            <ArchTopNav />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}
