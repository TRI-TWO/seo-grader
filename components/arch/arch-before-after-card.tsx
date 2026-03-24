import { ArchListCard } from "./arch-list-card";
import type { ArchListItem } from "@/lib/arch/client-types";

export function ArchBeforeAfterCard({ items }: { items: ArchListItem[] }) {
  return <ArchListCard title="Before / After" items={items} />;
}

