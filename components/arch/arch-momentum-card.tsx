import { ArchCard } from "./arch-card";
import type { ArchMomentumCard as MomentumData } from "@/lib/arch/client-types";

export function ArchMomentumCard({ data }: { data: MomentumData }) {
  return (
    <ArchCard title="Momentum">
      <div className="text-lg font-semibold mb-1">
        {data.delta > 0 ? "+" : ""}
        {data.delta} ({data.periodLabel})
      </div>
      <p>{data.summary}</p>
    </ArchCard>
  );
}

