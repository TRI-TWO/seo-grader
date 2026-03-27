"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { runAuditToBurnt, runBurntOrchestrate } from "@/lib/adminFlows";

type FlowId = "audit-to-burnt" | "burnt-orchestrate";

type Tool = {
  id: string;
  label: string;
  subtitle: string;
  descriptor: string;
  color: string;
  path: string;
  flows: FlowId[];
};

const serviceLanes: Tool[] = [
  { id: "smokey", label: "Smokey", subtitle: "SEO Project Tool", descriptor: "Planning and execution lane for SEO clients.", color: "#58595B", path: "/admin/smokey", flows: [] },
  { id: "wildcat", label: "Wildcat", subtitle: "CRM", descriptor: "Client communication and operational CRM lane.", color: "#0033A0", path: "/admin/wildcat", flows: [] },
  { id: "arch", label: "Arch", subtitle: "Presentation Portal", descriptor: "Presentation access path for client walkthroughs.", color: "#BA0C2F", path: "/admin/arch", flows: [] },
];

const actionTools: Tool[] = [
  { id: "burnt", label: "Burnt", subtitle: "Prioritization", descriptor: "Turns findings into prioritized implementation tracks.", color: "#BF5700", path: "/admin/burnt", flows: ["burnt-orchestrate"] },
  { id: "crimson", label: "Crimson", subtitle: "Content Engine", descriptor: "Builds and shapes content from selected strategy.", color: "#9E1B32", path: "/admin/crimson", flows: [] },
  { id: "midnight", label: "Midnight", subtitle: "Decision Engine", descriptor: "Decision and readiness framing before execution.", color: "#004953", path: "/admin/midnight", flows: [] },
];

const additionalTools: Tool[] = [
  { id: "audit", label: "Audit", subtitle: "SEO Scorer", descriptor: "Entry-point audit scoring and diagnostics.", color: "#f5c451", path: "/admin/audit", flows: ["audit-to-burnt"] },
  { id: "local", label: "Local", subtitle: "Readiness + Maps", descriptor: "Local visibility and map-focused readiness checks.", color: "#7c3aed", path: "/admin/local", flows: [] },
];

function ToolCard({ tool, onNavigate, onFlowOpen }: { tool: Tool; onNavigate: (path: string) => void; onFlowOpen: (flow: FlowId) => void; }) {
  return (
    <article
      onClick={() => onNavigate(tool.path)}
      onContextMenu={(e) => { e.preventDefault(); if (tool.flows.length > 0) onFlowOpen(tool.flows[0]); }}
      className="group cursor-pointer rounded-2xl border border-slate-700/70 bg-slate-900/40 p-5 transition hover:border-slate-500/80 hover:bg-slate-800/45"
      style={{ boxShadow: `inset 0 0 0 1px ${tool.color}33` }}
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight text-white">{tool.label}</h3>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            color: tool.color,
            backgroundColor: `${tool.color}26`,
            border: `1px solid ${tool.color}66`,
          }}
        >
          Tool
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-300">{tool.subtitle}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{tool.descriptor}</p>
      {tool.flows.length > 0 ? <p className="mt-4 text-xs font-medium" style={{ color: tool.color }}>Right-click for chained flow</p> : null}
    </article>
  );
}

function SectionBlock({ title, detail, children }: { title: string; detail: string; children: React.ReactNode; }) {
  return (
    <section className="rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-slate-900/90 to-slate-950/95 p-6 shadow-[0_0_0_1px_rgba(6,182,212,0.06),0_20px_50px_-20px_rgba(0,0,0,0.7)]">
      <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>
    </section>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeFlow, setActiveFlow] = useState<FlowId | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [tonePresetInput, setTonePresetInput] = useState("");
  const [modeInput, setModeInput] = useState<"homepage_edit" | "route_to_crimson">("homepage_edit");
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [flowResults, setFlowResults] = useState<any>(null);

  useEffect(() => { checkAdminAccess(); }, []);

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push("/login"); return; }
      if (user.email !== "mgr@tri-two.com") { router.push("/"); return; }
      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleTileClick = (path: string) => { router.push(path); };

  const handleChainFlow = async (flowId: FlowId) => {
    setFlowError(null);
    setFlowResults(null);
    setFlowLoading(true);
    try {
      const trimmedUrl = urlInput.trim();
      if (!trimmedUrl) { setFlowError("Please enter a URL"); setFlowLoading(false); return; }
      let results: any;
      switch (flowId) {
        case "audit-to-burnt": results = await runAuditToBurnt(trimmedUrl); break;
        case "burnt-orchestrate": results = await runBurntOrchestrate(trimmedUrl); break;
        default: setFlowError("Unknown flow"); setFlowLoading(false); return;
      }
      setFlowResults(results);
    } catch (err) {
      const e = err as { message?: string };
      setFlowError(e.message || "An error occurred. Please try again.");
    } finally {
      setFlowLoading(false);
    }
  };

  const openFlowModal = (flowId: FlowId) => {
    setActiveFlow(flowId);
    setUrlInput("");
    setGoalInput("");
    setTonePresetInput("");
    setModeInput("homepage_edit");
    setFlowError(null);
    setFlowResults(null);
  };

  const closeFlowModal = () => {
    setActiveFlow(null);
    setUrlInput("");
    setGoalInput("");
    setTonePresetInput("");
    setFlowError(null);
    setFlowResults(null);
  };

  const needsGoal = (_flowId: FlowId) => false;
  const needsMode = (_flowId: FlowId) => false;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2" style={{ borderColor: "#0033A0" }} />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="relative min-h-screen text-white">
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <section className="mb-6 rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-slate-900/90 to-slate-950/95 p-6 shadow-[0_0_0_1px_rgba(6,182,212,0.06),0_20px_50px_-20px_rgba(0,0,0,0.7)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">ADMIN COMMAND</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Prompt-driven operations workspace</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Service lanes manage client-facing work. Action tools execute the heavy lift. This layout mirrors Arch context so transitions stay clean.</p>
        </section>

        <div className="space-y-6">
          <SectionBlock title="Service lanes" detail="Smokey and Wildcat are primary operational lanes. Arch remains a presentation pathway.">
            {serviceLanes.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onNavigate={handleTileClick} onFlowOpen={openFlowModal} />
            ))}
          </SectionBlock>

          <SectionBlock title="Action tools" detail="Execution modules used after lane decisions are set.">
            {actionTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onNavigate={handleTileClick} onFlowOpen={openFlowModal} />
            ))}
          </SectionBlock>

          <SectionBlock title="Additional tools" detail="Supporting utilities kept available without dominating the workspace.">
            {additionalTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onNavigate={handleTileClick} onFlowOpen={openFlowModal} />
            ))}
          </SectionBlock>
        </div>
      </main>

      {activeFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-steel-gray bg-obsidian p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Run Chained Flow</h2>
              <button onClick={closeFlowModal} className="text-2xl text-cool-ash hover:text-white">×</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleChainFlow(activeFlow); }} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-cool-ash">URL *</label>
                <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://example.com" required disabled={flowLoading} className="w-full rounded-lg border border-steel-gray bg-void-black px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 disabled:opacity-50" style={{ "--tw-ring-color": "#0033A0" } as React.CSSProperties} />
              </div>

              {needsGoal(activeFlow) && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-cool-ash">Goal (for Crimson) *</label>
                  <textarea value={goalInput} onChange={(e) => setGoalInput(e.target.value)} placeholder="e.g., Increase conversions, improve trust signals..." required disabled={flowLoading} rows={3} className="w-full rounded-lg border border-steel-gray bg-void-black px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 disabled:opacity-50" style={{ "--tw-ring-color": "#0033A0" } as React.CSSProperties} />
                </div>
              )}

              {needsGoal(activeFlow) && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-cool-ash">Tone Preset (optional)</label>
                  <input type="text" value={tonePresetInput} onChange={(e) => setTonePresetInput(e.target.value)} placeholder="e.g., Professional, Friendly, Authoritative" disabled={flowLoading} className="w-full rounded-lg border border-steel-gray bg-void-black px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 disabled:opacity-50" style={{ "--tw-ring-color": "#0033A0" } as React.CSSProperties} />
                </div>
              )}

              {needsMode(activeFlow) && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-cool-ash">Midnight Mode *</label>
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input type="radio" name="mode" value="homepage_edit" checked={modeInput === "homepage_edit"} onChange={(e) => setModeInput(e.target.value as "homepage_edit" | "route_to_crimson")} disabled={flowLoading} className="h-5 w-5" style={{ accentColor: "#0033A0" }} />
                      <span>Homepage Edit</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input type="radio" name="mode" value="route_to_crimson" checked={modeInput === "route_to_crimson"} onChange={(e) => setModeInput(e.target.value as "homepage_edit" | "route_to_crimson")} disabled={flowLoading} className="h-5 w-5" style={{ accentColor: "#0033A0" }} />
                      <span>Route to Crimson</span>
                    </label>
                  </div>
                </div>
              )}

              {flowError && (
                <div className="rounded-lg border border-red-700 bg-red-600 px-4 py-3">
                  <div className="text-sm text-white">{flowError}</div>
                </div>
              )}

              {flowLoading && (
                <div className="py-4 text-center">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: "#0033A0" }} />
                  <p className="text-sm text-cool-ash">Running flow...</p>
                </div>
              )}

              {flowResults && (
                <div className="rounded-lg border border-steel-gray bg-void-black p-4">
                  <h3 className="mb-2 text-lg font-bold">Results</h3>
                  <pre className="max-h-64 overflow-auto text-xs text-cool-ash">{JSON.stringify(flowResults, null, 2)}</pre>
                </div>
              )}

              <div className="flex gap-4">
                <button type="submit" disabled={flowLoading} className="flex-1 rounded-lg bg-[#0033A0] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#1d4fc0] disabled:cursor-not-allowed disabled:opacity-50">
                  {flowLoading ? "Running..." : "Run Flow"}
                </button>
                <button type="button" onClick={closeFlowModal} disabled={flowLoading} className="rounded-lg border border-steel-gray bg-obsidian px-6 py-3 font-semibold text-white transition-colors hover:border-teal-500 disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
