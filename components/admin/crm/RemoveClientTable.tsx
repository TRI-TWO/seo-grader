"use client";

import { useMemo, useState } from "react";
import type { PortalClientListItem } from "@/lib/admin/crm/types";
import { DeleteClientsConfirmModal } from "./DeleteClientsConfirmModal";

type Props = {
  initialClients: PortalClientListItem[];
};

type RemovalSummary = {
  requested: number;
  removed: number;
  notFoundOrInactive: number;
  authBanFailures: string[];
};

export function RemoveClientTable({ initialClients }: Props) {
  const [clients, setClients] = useState(initialClients);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "deleting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [removalSummary, setRemovalSummary] = useState<RemovalSummary | null>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.contact_name.toLowerCase().includes(q)
    );
  }, [clients, filter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const ids = filtered.map((c) => c.client_id);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function confirmDelete() {
    const ids = Array.from(selected);
    setPhase("deleting");
    setError(null);
    setRemovalSummary(null);
    try {
      const res = await fetch("/api/admin/crm/portal-clients/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientIds: ids }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Remove failed");
        setPhase("error");
        return;
      }
      const requested = typeof json.requested === "number" ? json.requested : ids.length;
      const removed = typeof json.removed === "number" ? json.removed : 0;
      const notFoundOrInactive =
        typeof json.notFoundOrInactive === "number" ? json.notFoundOrInactive : Math.max(0, requested - removed);
      const authBanFailures = Array.isArray(json.authBanFailures)
        ? (json.authBanFailures as unknown[]).filter((x): x is string => typeof x === "string")
        : [];

      setRemovalSummary({
        requested,
        removed,
        notFoundOrInactive,
        authBanFailures,
      });

      setClients((list) => list.filter((c) => !ids.includes(c.client_id)));
      setSelected(new Set());
      setConfirmOpen(false);
      setPhase("idle");
    } catch {
      setError("Network error");
      setPhase("error");
    }
  }

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.client_id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="max-w-md rounded-lg border border-slate-600/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Search company, email, or contact…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!selected.size || phase === "deleting"}
            className="rounded-lg border border-rose-600/60 bg-rose-900/30 px-4 py-2 text-sm font-semibold text-rose-100 disabled:opacity-40"
          >
            Remove selected ({selected.size})
          </button>
        </div>
      </div>

      {removalSummary ? (
        <div
          className="rounded-lg border border-slate-600/60 bg-slate-900/50 px-4 py-3 text-sm text-slate-200"
          role="status"
        >
          <p className="font-medium text-emerald-200/90">Removal finished</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-300">
            <li>Requested: {removalSummary.requested}</li>
            <li>Soft-deleted (removed from active list): {removalSummary.removed}</li>
            <li>Already inactive or not found in active registrations: {removalSummary.notFoundOrInactive}</li>
          </ul>
          {removalSummary.authBanFailures.length ? (
            <div className="mt-3 border-t border-amber-700/40 pt-3">
              <p className="font-medium text-amber-200/90">
                Auth deactivation warnings ({removalSummary.authBanFailures.length})
              </p>
              <p className="mt-1 text-xs text-slate-400">
                CRM records were soft-deleted, but Supabase could not ban one or more users. Follow up in Supabase
                Auth if access must be revoked immediately.
              </p>
              <ul className="mt-2 max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-xs text-amber-100/90">
                {removalSummary.authBanFailures.map((line, i) => (
                  <li key={`${i}-${line.slice(0, 80)}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            className="mt-3 text-xs text-cyan-300/90 underline hover:text-cyan-200"
            onClick={() => setRemovalSummary(null)}
          >
            Dismiss summary
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-700/80">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="border-b border-slate-700/80 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible"
                  className="h-4 w-4 rounded border-slate-500"
                />
              </th>
              <th className="p-3">Company</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Email</th>
              <th className="p-3">Invite</th>
              <th className="p-3">Questionnaire</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.client_id} className="border-b border-slate-800/80 hover:bg-slate-900/40">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.client_id)}
                    onChange={() => toggle(c.client_id)}
                    className="h-4 w-4 rounded border-slate-500"
                  />
                </td>
                <td className="p-3 font-medium">{c.company_name}</td>
                <td className="p-3">{c.contact_name}</td>
                <td className="p-3 text-slate-400">{c.email}</td>
                <td
                  className="p-3 text-slate-400"
                  title={c.invite_last_error || undefined}
                >
                  <span>{c.invite_status}</span>
                  {c.invite_last_error ? (
                    <span className="ml-1 text-amber-400" aria-label={c.invite_last_error}>
                      !
                    </span>
                  ) : null}
                </td>
                <td className="p-3 text-slate-400">{c.questionnaire_status}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  No clients match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <DeleteClientsConfirmModal
        open={confirmOpen}
        count={selected.size}
        loading={phase === "deleting"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
