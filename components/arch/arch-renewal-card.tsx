import { ArchListCard } from "./arch-list-card";
import type { ArchListItem } from "@/lib/arch/client-types";

export function ArchRenewalCard({ items }: { items: ArchListItem[] }) {
  return <ArchListCard title="Renewal / Updates" items={items} />;
}

