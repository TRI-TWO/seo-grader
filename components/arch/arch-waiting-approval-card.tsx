import { ArchListCard } from "./arch-list-card";
import type { ArchListItem } from "@/lib/arch/client-types";

export function ArchWaitingApprovalCard({ items }: { items: ArchListItem[] }) {
  return <ArchListCard title="Waiting Approval" items={items} />;
}

