import { ArchListCard } from "./arch-list-card";
import type { ArchListItem } from "@/lib/arch/client-types";

export function ArchActivityFeedCard({ items }: { items: ArchListItem[] }) {
  return <ArchListCard title="Latest Activity" items={items} />;
}

