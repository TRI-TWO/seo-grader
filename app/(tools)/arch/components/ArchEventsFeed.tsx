"use client";

import type { FC } from "react";

interface ArchEvent {
  id: string;
  event_type: string;
  severity: string;
  title: string;
  detail: string | null;
  as_of_date: string;
  created_at: string;
}

interface ArchEventsFeedProps {
  events: ArchEvent[];
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500 text-white",
  warning: "bg-yellow-400 text-black",
  info: "bg-sky-500 text-white",
};

export const ArchEventsFeed: FC<ArchEventsFeedProps> = ({ events }) => {
  return (
    <section className="bg-obsidian rounded-lg border border-steel-gray p-6">
      <h2 className="text-xl font-bold text-white mb-4">Recent Events</h2>
      {events.length === 0 ? (
        <p className="text-sm text-cool-ash">
          When significant changes occur (deltas in score, new issues, milestones),
          they will appear here.
        </p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {events.map((event) => {
            const severityClass =
              SEVERITY_BADGE[event.severity] ?? "bg-zinc-600 text-white";
            const created = new Date(event.created_at);

            return (
              <div
                key={event.id}
                className="bg-void-black rounded-lg border border-zinc-700 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${severityClass}`}
                      >
                        {event.severity}
                      </span>
                      <span className="text-xs text-gray-400">
                        {created.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {event.title}
                    </div>
                    {event.detail && (
                      <div className="text-xs text-cool-ash mt-1">
                        {event.detail}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {event.event_type}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

