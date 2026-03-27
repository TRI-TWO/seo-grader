import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function ArchDashboardSurface({ children, className = "" }: Props) {
  return (
    <div
      className={`rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-slate-900/90 to-slate-950/95 shadow-[0_0_0_1px_rgba(6,182,212,0.06),0_20px_50px_-20px_rgba(0,0,0,0.7)] ${className}`}
    >
      {children}
    </div>
  );
}
