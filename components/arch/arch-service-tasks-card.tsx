import type {
  ArchServiceTaskItem,
  ArchServiceTasksViewModel,
} from "@/lib/arch/client-types";
import { ArchDashboardSurface } from "./arch-dashboard-surface";

function TaskCol({
  title,
  items,
}: {
  title: string;
  items: ArchServiceTaskItem[];
}) {
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {items.length === 0 ? (
          <li className="text-xs text-slate-600">None right now.</li>
        ) : (
          items.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-slate-800/80 bg-slate-900/50 px-3 py-2"
            >
              <p className="text-sm font-medium text-slate-200">{t.title}</p>
              {t.detail ? (
                <p className="mt-0.5 text-xs text-slate-500">{t.detail}</p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function ArchServiceTasksCard({
  data,
}: {
  data: ArchServiceTasksViewModel;
}) {
  if (!data.enabled && data.mode === "upsell") {
    return (
      <ArchDashboardSurface className="p-6">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          SEO service tasks
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {data.upsellHeadline ?? "Task queue"}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          {data.upsellDetail ??
            "When SEO management is active, tasks waiting approval, in progress, and scheduled work appear here."}
        </p>
      </ArchDashboardSurface>
    );
  }

  return (
    <ArchDashboardSurface className="p-6">
      <h2 className="text-lg font-semibold tracking-tight text-white">
        SEO service tasks
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Waiting approval, active execution, and what&apos;s queued next.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
        <TaskCol title="Waiting approval" items={data.waitingApproval} />
        <TaskCol title="Active" items={data.active} />
        <TaskCol title="Upcoming" items={data.upcoming} />
      </div>
    </ArchDashboardSurface>
  );
}
