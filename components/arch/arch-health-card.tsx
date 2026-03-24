import { ArchCard } from "./arch-card";
import type { ArchHealthCard as HealthData } from "@/lib/arch/client-types";

export function ArchHealthCard({ data }: { data: HealthData }) {
  return (
    <ArchCard title="SEO Health">
      <div className="text-3xl font-bold mb-1">{data.score}</div>
      <div className="text-xs text-zinc-400 uppercase tracking-wide mb-2">
        {data.status} · {data.direction}
      </div>
      <p>{data.summary}</p>
    </ArchCard>
  );
}

