import { ArchListCard } from "./arch-list-card";
import type { ArchListItem } from "@/lib/arch/client-types";

export function ArchWhyItMattersCard({ items }: { items: ArchListItem[] }) {
  return <ArchListCard title="Why It Matters" items={items} />;
}

