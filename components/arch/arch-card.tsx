import type { ReactNode } from "react";

type ArchCardProps = {
  title: string;
  children: ReactNode;
};

export function ArchCard({ title, children }: ArchCardProps) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-2">{title}</h2>
      <div className="text-sm text-zinc-100">{children}</div>
    </section>
  );
}

