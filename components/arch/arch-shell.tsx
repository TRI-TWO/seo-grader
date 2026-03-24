import type { ReactNode } from "react";
import { ArchTopNav } from "./arch-top-nav";

type ArchShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ArchShell({ title, subtitle, children }: ArchShellProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400">
              TRI-TWO
            </div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle ? <p className="text-sm text-zinc-400">{subtitle}</p> : null}
          </div>
          <ArchTopNav />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

