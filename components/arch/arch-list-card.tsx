import { ArchCard } from "./arch-card";
import type { ArchListItem } from "@/lib/arch/client-types";

export function ArchListCard({
  title,
  items,
}: {
  title: string;
  items: ArchListItem[];
}) {
  return (
    <ArchCard title={title}>
      {items.length === 0 ? (
        <p className="text-zinc-400">No updates yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={`${item.title}-${i}`}>
              <div className="font-semibold">{item.title}</div>
              <div className="text-zinc-300">{item.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </ArchCard>
  );
}

