"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AdminArchTab = "configuration" | "signals" | "snapshots" | "preview";

interface AdminClientSummary {
  id: string;
  companyName: string | null;
  canonicalUrl: string;
  planTier: string;
  status: string;
}

interface ArchSummaryResponse {
  client: AdminClientSummary | null;
  categories: any[];
  signals: any[];
  rules: any[];
  latestSnapshot: any | null;
}

function AdminArchPageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminArchTab>("configuration");
  const [clients, setClients] = useState<AdminClientSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ArchSummaryResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<any | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          router.push("/login");
          return;
        }

        if (user.email !== "mgr@tri-two.com") {
          router.push("/");
          return;
        }

        setIsAdmin(true);
        await loadClients();
      } catch (err) {
        console.error("Error checking admin access for Arch:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [router]);

  useEffect(() => {
    if (isAdmin && selectedClientId) {
      void loadSummary(selectedClientId);
    }
  }, [isAdmin, selectedClientId]);

  const loadClients = async () => {
    try {
      const res = await fetch("/api/admin/clients");
      if (!res.ok) return;
      const json = await res.json();
      const list: AdminClientSummary[] = (json.clients || []).map((c: any) => ({
        id: c.id,
        companyName: c.companyName,
        canonicalUrl: c.canonicalUrl,
        planTier: c.planTier,
        status: c.status,
      }));
      setClients(list);
      if (list.length > 0) {
        setSelectedClientId(list[0].id);
      }
    } catch (err) {
      console.error("Error loading clients for Arch admin:", err);
    }
  };

  const loadSummary = async (clientId: string) => {
    try {
      const res = await fetch(`/api/admin/arch/summary?clientId=${clientId}`);
      if (!res.ok) return;
      const json = (await res.json()) as ArchSummaryResponse;
      setSummary(json);
      setPreviewSnapshot(json.latestSnapshot);
      setPreviewError(null);
    } catch (err) {
      console.error("Error loading Arch summary:", err);
    }
  };

  const handlePreviewScore = async () => {
    if (!selectedClientId) return;

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewSnapshot(null);

    try {
      const res = await fetch("/api/admin/arch/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          dryRun: true,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setPreviewError(json.error || "Failed to preview score");
        return;
      }

      const json = await res.json();
      setPreviewSnapshot(json.snapshot);
    } catch (err: any) {
      setPreviewError(err?.message || "Failed to preview score");
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-200px)] px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div
              className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
              style={{ borderColor: "#2F80FF" }}
            ></div>
            <p className="text-cool-ash">Loading Arch admin...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const tabs: { id: AdminArchTab; label: string; description: string }[] = [
    {
      id: "configuration",
      label: "Configuration",
      description: "Per-client Arch enablement and category weights.",
    },
    {
      id: "signals",
      label: "Signals & Rules",
      description: "Manage health signals, thresholds, and actions.",
    },
    {
      id: "snapshots",
      label: "Snapshots",
      description: "Inspect stored daily scores and events.",
    },
    {
      id: "preview",
      label: "Score Preview",
      description: "Run dry-run scoring for a given client and date.",
    },
  ];

  return (
    <main className="min-h-[calc(100vh-200px)] px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/admin" className="text-laser-blue hover:text-light-blue-tint">
            ← Back to Admin Dashboard
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Arch</h1>
          <p className="text-gray-400 text-sm mb-1">
            Client-facing SEO & growth health layer.
          </p>
          <p className="text-cool-ash text-sm">
            Configure categories, signals, rules, and snapshots for each client. This
            page will evolve into the full Arch rule builder and configuration
            surface.
          </p>
        </header>

        <nav className="flex gap-4 mb-8 border-b border-steel-gray">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-laser-blue text-laser-blue"
                  : "border-transparent text-cool-ash hover:text-cool-ash"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="bg-obsidian rounded-lg border border-steel-gray p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-cool-ash text-sm">
                {tabs.find((t) => t.id === activeTab)?.description}
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <label className="text-xs text-cool-ash uppercase tracking-wide">
                Client
              </label>
              <select
                className="bg-void-black border border-steel-gray rounded-md px-3 py-2 text-sm text-white"
                value={selectedClientId ?? ""}
                onChange={(e) => setSelectedClientId(e.target.value || null)}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName || client.canonicalUrl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeTab === "configuration" && (
            <div className="space-y-4">
              {summary?.client && (
                <div className="bg-void-black rounded-lg border border-zinc-700 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {summary.client.companyName || summary.client.canonicalUrl}
                    </div>
                    <div className="text-xs text-cool-ash mt-1">
                      {summary.client.canonicalUrl}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-blue-600 text-white">
                      {summary.client.planTier}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-zinc-700 text-gray-200">
                      {summary.client.status}
                    </span>
                  </div>
                </div>
              )}
              <div className="text-sm text-cool-ash">
                Category and signal configuration will be editable here. For now,
                Arch reads configuration from the underlying tables seeded for each
                client.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Categories
                  </h3>
                  <div className="space-y-2 text-sm text-gray-200">
                    {(summary?.categories || []).map((cat: any) => (
                      <div
                        key={cat.id}
                        className="bg-void-black rounded-lg border border-zinc-700 p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium">{cat.label}</div>
                          <div className="text-xs text-cool-ash">
                            key: {cat.key} · weight: {cat.weight}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {cat.is_enabled ? "Enabled" : "Disabled"}
                        </div>
                      </div>
                    ))}
                    {summary && summary.categories.length === 0 && (
                      <div className="text-xs text-cool-ash">
                        No categories configured for this client yet.
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Signals
                  </h3>
                  <div className="space-y-2 text-sm text-gray-200 max-h-64 overflow-y-auto pr-1">
                    {(summary?.signals || []).map((signal: any) => (
                      <div
                        key={signal.id}
                        className="bg-void-black rounded-lg border border-zinc-700 p-3"
                      >
                        <div className="font-medium">{signal.label}</div>
                        <div className="text-xs text-cool-ash mt-1">
                          key: {signal.key} · weight: {signal.weight} · direction:{" "}
                          {signal.direction}
                        </div>
                      </div>
                    ))}
                    {summary && summary.signals.length === 0 && (
                      <div className="text-xs text-cool-ash">
                        No signals configured for this client yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "signals" && (
            <div className="space-y-4">
              <p className="text-sm text-cool-ash">
                Rule builder UI will live here. For now, this view lists the raw
                rules for quick inspection.
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-sm text-gray-200">
                {(summary?.rules || []).map((rule: any) => (
                  <div
                    key={rule.id}
                    className="bg-void-black rounded-lg border border-zinc-700 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs uppercase tracking-wide text-gray-400">
                        {rule.rule_type} · {rule.operator} {rule.threshold}
                      </div>
                      <div className="text-xs text-gray-300">
                        {rule.points > 0 ? "+" : ""}
                        {rule.points} pts
                      </div>
                    </div>
                    <div className="text-sm text-white mb-1">{rule.message}</div>
                    {rule.action_title && (
                      <div className="text-xs text-cool-ash">
                        Action: {rule.action_title}
                      </div>
                    )}
                  </div>
                ))}
                {summary && summary.rules.length === 0 && (
                  <div className="text-xs text-cool-ash">
                    No rules configured for this client yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "snapshots" && (
            <div className="space-y-4">
              <p className="text-sm text-cool-ash">
                Snapshot history will be expanded here. Currently the latest
                snapshot is available in the preview tab and via the client-facing
                dashboard.
              </p>
            </div>
          )}

          {activeTab === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-cool-ash">
                Run a dry-run Arch compute for the selected client and inspect the
                score, category breakdown, and top drivers.
              </p>
              <button
                onClick={handlePreviewScore}
                disabled={previewLoading || !selectedClientId}
                className="px-4 py-2 rounded-md bg-[#2F80FF] text-white text-sm font-semibold disabled:opacity-60"
              >
                {previewLoading ? "Computing..." : "Preview Score"}
              </button>
              {previewError && (
                <div className="text-sm text-red-400">{previewError}</div>
              )}
              {previewSnapshot && (
                <div className="mt-2 text-sm text-gray-200 space-y-2">
                  <div>
                    <span className="font-semibold">Overall: </span>
                    {previewSnapshot.overallScore}
                  </div>
                  <div>
                    <span className="font-semibold">Categories: </span>
                    <pre className="mt-1 text-xs bg-void-black rounded-md border border-zinc-700 p-3 overflow-auto">
                      {JSON.stringify(previewSnapshot.categoryScores, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function AdminArchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-200px)] px-6 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <div
                className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
                style={{ borderColor: "#2F80FF" }}
              ></div>
              <p className="text-cool-ash">Loading Arch admin...</p>
            </div>
          </div>
        </main>
      }
    >
      <AdminArchPageContent />
    </Suspense>
  );
}

