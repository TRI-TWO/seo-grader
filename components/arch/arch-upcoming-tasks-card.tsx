import { ArchListCard } from "./arch-list-card";
import type { ArchListItem } from "@/lib/arch/client-types";

export function ArchUpcomingTasksCard({ items }: { items: ArchListItem[] }) {
  return <ArchListCard title="Upcoming Tasks" items={items} />;
}

