import { ArchListCard } from "./arch-list-card";
import type { ArchListItem } from "@/lib/arch/client-types";

export function ArchWhatWeDidCard({ items }: { items: ArchListItem[] }) {
  return <ArchListCard title="What We Did" items={items} />;
}

