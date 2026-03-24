import { ArchListCard } from "./arch-list-card";
import type { ArchListItem } from "@/lib/arch/client-types";

export function ArchNextStepsCard({ items }: { items: ArchListItem[] }) {
  return <ArchListCard title="What’s Next" items={items} />;
}

