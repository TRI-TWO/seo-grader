"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import HamburgerMenu from "@/components/HamburgerMenu";
import type { BurntScoreAPIResponse, BurntOrchestrateAPIResponse, Action, PrioritizedAction, PriorityBand } from "@/lib/llms/types";

type TabType = "score" | "orchestrate";

export default function AdminBurntPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("score");
  
  // Score Actions tab state
  const [actionsInput, setActionsInput] = useState("");
  const [scoreResults, setScoreResults] = useState<BurntScoreAPIResponse | null>(null);
  
  // Full Run tab state
  const [urlInput, setUrlInput] = useState("");
  const [runAudit, setRunAudit] = useState(false);
  const [runMidnight, setRunMidnight] = useState(false);
  const [runCrimson, setRunCrimson] = useState(false);
  const [orchestrateResults, setOrchestrateResults] = useState<BurntOrchestrateAPIResponse | null>(null);
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push("/login");
        return;
      }

      const role = (user.user_metadata?.role as string) || 'VISITOR';
      if (role !== "ADMIN") {
        router.push("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/login");
    }
  };

  const handleScoreActions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionsInput.trim()) {
      setError("Please enter actions to score");
      return;
    }

    setLoading(true);
    setError(null);
    setScoreResults(null);

    try {
      // Parse actions from text input (assuming JSON array or one per line)
      let actions: Action[];
      try {
        actions = JSON.parse(actionsInput);
        if (!Array.isArray(actions)) {
          throw new Error("Actions must be an array");
        }
      } catch {
        // Try parsing as one action per line
        const lines = actionsInput.split('\n').filter(line => line.trim());
        actions = lines.map((line, idx) => ({
          id: `action-${idx}`,
          title: line.split(':')[0] || `Action ${idx + 1}`,
          description: line.split(':').slice(1).join(':').trim() || line.trim(),
        }));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("/api/llm/burnt/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ actions }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        setError(errorData.error || "Failed to score actions. Please try again.");
        setLoading(false);
        return;
      }

      const responseData: BurntScoreAPIResponse = await response.json();
      setScoreResults(responseData);
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFullRun = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      setError("Please enter a URL");
      return;
    }

    if (!runAudit && !runMidnight && !runCrimson) {
      setError("Please select at least one step to run");
      return;
    }

    setLoading(true);
    setError(null);
    setOrchestrateResults(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

    try {
      const response = await fetch("/api/llm/burnt/orchestrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: trimmedUrl,
          runAudit,
          runMidnight,
          runCrimson,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        setError(errorData.error || "Failed to run orchestration. Please try again.");
        setLoading(false);
        return;
      }

      const responseData: BurntOrchestrateAPIResponse = await response.json();
      setOrchestrateResults(responseData);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBandColor = (band: PriorityBand): string => {
    switch (band) {
      case 'Do now':
        return 'text-red-400';
      case 'High priority':
        return 'text-orange-400';
      case 'Opportunistic':
        return 'text-yellow-400';
      case 'Backlog':
        return 'text-cool-ash';
      default:
        return 'text-cool-ash';
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-void-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void-black text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.05) 35px, rgba(255,255,255,0.05) 70px)",
          }}
        />
      </div>

      <div className="relative z-10">
        <header className="flex items-center justify-between px-6 py-4 md:px-12 md:py-6">
          <div className="flex-shrink-0">
            <BrandLogo />
          </div>
          <div className="flex-shrink-0">
            <HamburgerMenu />
          </div>
        </header>

        <main className="min-h-[calc(100vh-200px)] px-6 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <Link href="/admin" className="text-laser-blue hover:text-light-blue-tint">
                ← Back to Admin Dashboard
              </Link>
            </div>

            <h1 className="text-4xl font-bold mb-4">Burnt</h1>
            <p className="text-cool-ash mb-8">
              Prioritize actions into an execution order
            </p>

            {/* Tabs */}
            <div className="flex gap-4 mb-8 border-b border-steel-gray">
              <button
                onClick={() => setActiveTab("score")}
                className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                  activeTab === "score"
                    ? "border-laser-blue text-laser-blue"
                    : "border-transparent text-cool-ash hover:text-cool-ash"
                }`}
              >
                Score Actions
              </button>
              <button
                onClick={() => setActiveTab("orchestrate")}
                className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                  activeTab === "orchestrate"
                    ? "border-laser-blue text-laser-blue"
                    : "border-transparent text-cool-ash hover:text-cool-ash"
                }`}
              >
                Full Run
              </button>
            </div>

            {error && (
              <div className="bg-red-600 border border-red-700 rounded-lg px-6 py-4 mb-8">
                <div className="text-white font-semibold mb-2">Error</div>
                <div className="text-red-100">{error}</div>
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
                <p className="text-cool-ash">
                  {activeTab === "score" ? "Scoring actions..." : "Running orchestration..."}
                </p>
              </div>
            )}

            {/* Score Actions Tab */}
            {activeTab === "score" && (
              <div>
                <form onSubmit={handleScoreActions} className="mb-8">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-cool-ash mb-2">
                      Actions (JSON array or one per line)
                    </label>
                    <textarea
                      placeholder='[{"title": "Action 1", "description": "Description"}, ...] or one action per line'
                      value={actionsInput}
                      onChange={(e) => setActionsInput(e.target.value)}
                      disabled={loading}
                      rows={8}
                      className="w-full px-6 py-4 bg-obsidian border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 font-mono text-sm"
                      style={{ '--tw-ring-color': '#2F80FF' } as React.CSSProperties}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-4 bg-[#2F80FF] hover:bg-[#2F80FF] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Score Actions
                  </button>
                </form>

                {scoreResults && (
                  <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                    <h2 className="text-2xl font-bold mb-4">Prioritized Actions</h2>
                    <div className="space-y-4">
                      {scoreResults.prioritizedActions.map((action: PrioritizedAction, idx: number) => (
                        <div key={idx} className="border-b border-steel-gray pb-4 last:border-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-semibold text-lg">{action.title}</div>
                              <div className="text-cool-ash text-sm mt-1">{action.description}</div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-2xl font-bold text-laser-blue">{action.burntScore.total}</div>
                              <div className={`text-sm font-semibold ${getPriorityBandColor(action.priorityBand)}`}>
                                {action.priorityBand}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                            <div>
                              <div className="text-cool-ash">Impact</div>
                              <div className="font-semibold">{action.burntScore.impact}/25</div>
                            </div>
                            <div>
                              <div className="text-cool-ash">Confidence</div>
                              <div className="font-semibold">{action.burntScore.confidence}/25</div>
                            </div>
                            <div>
                              <div className="text-cool-ash">Effort (Inv)</div>
                              <div className="font-semibold">{action.burntScore.effort_inverse}/25</div>
                            </div>
                            <div>
                              <div className="text-cool-ash">Urgency</div>
                              <div className="font-semibold">{action.burntScore.urgency}/25</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Full Run Tab */}
            {activeTab === "orchestrate" && (
              <div>
                <form onSubmit={handleFullRun} className="mb-8 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-cool-ash mb-2">
                      URL *
                    </label>
                    <input
                      type="text"
                      placeholder="https://example.com"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      disabled={loading}
                      className="w-full px-6 py-4 bg-obsidian border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
                      style={{ '--tw-ring-color': '#2F80FF' } as React.CSSProperties}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cool-ash mb-3">
                      Steps to Run
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={runAudit}
                          onChange={(e) => setRunAudit(e.target.checked)}
                          disabled={loading}
                          className="w-5 h-5"
                          style={{ accentColor: '#2F80FF' }}
                        />
                        <div>
                          <div className="font-semibold">Run Audit</div>
                          <div className="text-sm text-cool-ash">Baseline diagnostics and scoring</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={runMidnight}
                          onChange={(e) => setRunMidnight(e.target.checked)}
                          disabled={loading}
                          className="w-5 h-5"
                          style={{ accentColor: '#2F80FF' }}
                        />
                        <div>
                          <div className="font-semibold">Run Midnight</div>
                          <div className="text-sm text-cool-ash">Homepage structure analysis</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={runCrimson}
                          onChange={(e) => setRunCrimson(e.target.checked)}
                          disabled={loading}
                          className="w-5 h-5"
                          style={{ accentColor: '#2F80FF' }}
                        />
                        <div>
                          <div className="font-semibold">Run Crimson</div>
                          <div className="text-sm text-cool-ash">Content optimization</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-8 py-4 bg-[#2F80FF] hover:bg-[#2F80FF] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Running Orchestration..." : "Run Full Orchestration"}
                  </button>
                </form>

                {orchestrateResults && (
                  <div className="space-y-6">
                    {orchestrateResults.audit && (
                      <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                        <h2 className="text-2xl font-bold mb-4">Audit Results</h2>
                        <div className="text-cool-ash">SEO Score: {orchestrateResults.audit.seoScore || 'N/A'}</div>
                      </div>
                    )}

                    {orchestrateResults.midnight && (
                      <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                        <h2 className="text-2xl font-bold mb-4">Midnight Results</h2>
                        <div className="text-cool-ash">
                          {orchestrateResults.midnight.structureRecommendations.length} structure recommendations
                        </div>
                      </div>
                    )}

                    {orchestrateResults.crimson && (
                      <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                        <h2 className="text-2xl font-bold mb-4">Crimson Results</h2>
                        <div className="text-cool-ash">
                          {orchestrateResults.crimson.contentEdits.length} content edits,
                          {orchestrateResults.crimson.ctaSuggestions.length} CTA suggestions
                        </div>
                      </div>
                    )}

                    {orchestrateResults.burnt.prioritizedActions.length > 0 && (
                      <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                        <h2 className="text-2xl font-bold mb-4">Prioritized Actions</h2>
                        <div className="space-y-4">
                          {orchestrateResults.burnt.prioritizedActions.map((action: PrioritizedAction, idx: number) => (
                            <div key={idx} className="border-b border-steel-gray pb-4 last:border-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="font-semibold">{action.title}</div>
                                  <div className="text-cool-ash text-sm mt-1">{action.description}</div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-xl font-bold text-laser-blue">{action.burntScore.total}</div>
                                  <div className={`text-sm font-semibold ${getPriorityBandColor(action.priorityBand)}`}>
                                    {action.priorityBand}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

