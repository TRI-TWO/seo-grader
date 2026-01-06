"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import HamburgerMenu from "@/components/HamburgerMenu";
import {
  runAuditToCrimson,
  runAuditToMidnight,
  runAuditToBurnt,
  runCrimsonToMidnight,
  runCrimsonToBurnt,
  runMidnightToCrimson,
  runMidnightToBurnt,
  runBurntOrchestrate,
} from "@/lib/adminFlows";

type FlowAction = {
  id: string;
  label: string;
  type: 'standalone' | 'chain';
  handler: () => void;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Modal/form state
  const [activeFlow, setActiveFlow] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [tonePresetInput, setTonePresetInput] = useState("");
  const [modeInput, setModeInput] = useState<'homepage_edit' | 'route_to_crimson'>('homepage_edit');
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [flowResults, setFlowResults] = useState<any>(null);

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

      // Check role from user metadata
      const role = (user.user_metadata?.role as string) || 'VISITOR';
      if (role !== "ADMIN") {
        router.push("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleStandalone = (path: string) => {
    router.push(path);
  };

  const handleChainFlow = async (flowId: string) => {
    setFlowError(null);
    setFlowResults(null);
    setFlowLoading(true);

    try {
      const trimmedUrl = urlInput.trim();
      if (!trimmedUrl) {
        setFlowError("Please enter a URL");
        setFlowLoading(false);
        return;
      }

      let results: any;

      switch (flowId) {
        case 'audit-to-crimson':
          if (!goalInput.trim()) {
            setFlowError("Please enter a goal for Crimson");
            setFlowLoading(false);
            return;
          }
          results = await runAuditToCrimson(trimmedUrl, goalInput.trim(), tonePresetInput.trim() || undefined);
          break;
        
        case 'audit-to-midnight':
          results = await runAuditToMidnight(trimmedUrl, modeInput);
          break;
        
        case 'audit-to-burnt':
          results = await runAuditToBurnt(trimmedUrl);
          break;
        
        case 'crimson-to-midnight':
          if (!goalInput.trim()) {
            setFlowError("Please enter a goal for Crimson");
            setFlowLoading(false);
            return;
          }
          results = await runCrimsonToMidnight(trimmedUrl, goalInput.trim(), tonePresetInput.trim() || undefined);
          break;
        
        case 'crimson-to-burnt':
          if (!goalInput.trim()) {
            setFlowError("Please enter a goal for Crimson");
            setFlowLoading(false);
            return;
          }
          results = await runCrimsonToBurnt(trimmedUrl, goalInput.trim(), tonePresetInput.trim() || undefined);
          break;
        
        case 'midnight-to-crimson':
          if (!goalInput.trim()) {
            setFlowError("Please enter a goal for Crimson");
            setFlowLoading(false);
            return;
          }
          results = await runMidnightToCrimson(trimmedUrl, modeInput, goalInput.trim(), tonePresetInput.trim() || undefined);
          break;
        
        case 'midnight-to-burnt':
          results = await runMidnightToBurnt(trimmedUrl, modeInput);
          break;
        
        case 'burnt-orchestrate':
          results = await runBurntOrchestrate(trimmedUrl);
          break;
        
        default:
          setFlowError("Unknown flow");
          setFlowLoading(false);
          return;
      }

      setFlowResults(results);
      // Optionally redirect to appropriate page or show results inline
    } catch (err: any) {
      setFlowError(err.message || "An error occurred. Please try again.");
    } finally {
      setFlowLoading(false);
    }
  };

  const openFlowModal = (flowId: string) => {
    setActiveFlow(flowId);
    setUrlInput("");
    setGoalInput("");
    setTonePresetInput("");
    setModeInput('homepage_edit');
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

  const needsGoal = (flowId: string) => {
    return flowId.includes('crimson') || flowId === 'midnight-to-crimson';
  };

  const needsMode = (flowId: string) => {
    return flowId.includes('midnight');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-void-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
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
        <header className="bg-void-black flex items-center justify-between px-6 py-4 md:px-12 md:py-6">
          <div className="flex-shrink-0">
            <BrandLogo />
          </div>
          <div className="flex-shrink-0">
            <HamburgerMenu />
          </div>
        </header>

        <main className="min-h-[calc(100vh-200px)] px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">
              Admin Dashboard
            </h1>
            <p className="text-xl text-cool-ash text-center mb-12">
              Unified LLM SEO Decision System
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Run Audit */}
              <div className="bg-obsidian rounded-lg border border-steel-gray p-6 hover:border-teal-500 transition-colors">
                <div className="text-2xl font-bold mb-3" style={{ color: '#2F80FF' }}>
                  Run Audit
                </div>
                <p className="text-cool-ash mb-4 text-sm">
                  Baseline diagnostics and scoring using Peach audit engine
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleStandalone('/admin/audit')}
                    className="w-full px-4 py-2 bg-[#2F80FF] hover:bg-[#2566cc] text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Run Audit (standalone)
                  </button>
                  <button
                    onClick={() => openFlowModal('audit-to-crimson')}
                    className="w-full px-4 py-2 bg-obsidian border border-steel-gray hover:border-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Run Audit → Crimson
                  </button>
                  <button
                    onClick={() => openFlowModal('audit-to-midnight')}
                    className="w-full px-4 py-2 bg-obsidian border border-steel-gray hover:border-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Run Audit → Midnight
                  </button>
                  <button
                    onClick={() => openFlowModal('audit-to-burnt')}
                    className="w-full px-4 py-2 bg-obsidian border border-steel-gray hover:border-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Run Audit → Burnt
                  </button>
                </div>
              </div>

              {/* Card 2: Crimson */}
              <div className="bg-obsidian rounded-lg border border-steel-gray p-6 hover:border-teal-500 transition-colors">
                <div className="text-2xl font-bold mb-3" style={{ color: '#2F80FF' }}>
                  Crimson
                </div>
                <p className="text-cool-ash mb-4 text-sm">
                  Content creation and editing engine
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleStandalone('/admin/crimson')}
                    className="w-full px-4 py-2 bg-[#2F80FF] hover:bg-[#2566cc] text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Launch Crimson (standalone)
                  </button>
                  <button
                    onClick={() => openFlowModal('crimson-to-midnight')}
                    className="w-full px-4 py-2 bg-obsidian border border-steel-gray hover:border-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Crimson → Midnight
                  </button>
                  <button
                    onClick={() => openFlowModal('crimson-to-burnt')}
                    className="w-full px-4 py-2 bg-obsidian border border-steel-gray hover:border-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Crimson → Burnt
                  </button>
                </div>
              </div>

              {/* Card 3: Midnight */}
              <div className="bg-obsidian rounded-lg border border-steel-gray p-6 hover:border-teal-500 transition-colors">
                <div className="text-2xl font-bold mb-3" style={{ color: '#2F80FF' }}>
                  Midnight
                </div>
                <p className="text-cool-ash mb-4 text-sm">
                  Homepage, structure, and optimization decision engine
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleStandalone('/admin/midnight')}
                    className="w-full px-4 py-2 bg-[#2F80FF] hover:bg-[#2566cc] text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Launch Midnight (standalone)
                  </button>
                  <button
                    onClick={() => openFlowModal('midnight-to-crimson')}
                    className="w-full px-4 py-2 bg-obsidian border border-steel-gray hover:border-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Midnight → Crimson
                  </button>
                  <button
                    onClick={() => openFlowModal('midnight-to-burnt')}
                    className="w-full px-4 py-2 bg-obsidian border border-steel-gray hover:border-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Midnight → Burnt
                  </button>
                </div>
              </div>

              {/* Card 4: Burnt */}
              <div className="bg-obsidian rounded-lg border border-steel-gray p-6 hover:border-teal-500 transition-colors">
                <div className="text-2xl font-bold mb-3" style={{ color: '#2F80FF' }}>
                  Burnt
                </div>
                <p className="text-cool-ash mb-4 text-sm">
                  System-level synthesis and optimization engine
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleStandalone('/admin/burnt')}
                    className="w-full px-4 py-2 bg-[#2F80FF] hover:bg-[#2566cc] text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Launch Burnt (standalone)
                  </button>
                  <button
                    onClick={() => openFlowModal('burnt-orchestrate')}
                    className="w-full px-4 py-2 bg-obsidian border border-steel-gray hover:border-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Burnt (orchestrate Audit → Crimson → Midnight)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Flow Modal */}
        {activeFlow && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-obsidian rounded-lg border border-steel-gray p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Run Chained Flow</h2>
                <button
                  onClick={closeFlowModal}
                  className="text-cool-ash hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleChainFlow(activeFlow);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-cool-ash mb-2">
                    URL *
                  </label>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    required
                    disabled={flowLoading}
                    className="w-full px-4 py-3 bg-void-black border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
                    style={{ '--tw-ring-color': '#2F80FF' } as React.CSSProperties}
                  />
                </div>

                {needsGoal(activeFlow) && (
                  <div>
                    <label className="block text-sm font-medium text-cool-ash mb-2">
                      Goal (for Crimson) *
                    </label>
                    <textarea
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      placeholder="e.g., Increase conversions, improve trust signals..."
                      required
                      disabled={flowLoading}
                      rows={3}
                      className="w-full px-4 py-3 bg-void-black border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
                      style={{ '--tw-ring-color': '#2F80FF' } as React.CSSProperties}
                    />
                  </div>
                )}

                {needsGoal(activeFlow) && (
                  <div>
                    <label className="block text-sm font-medium text-cool-ash mb-2">
                      Tone Preset (optional)
                    </label>
                    <input
                      type="text"
                      value={tonePresetInput}
                      onChange={(e) => setTonePresetInput(e.target.value)}
                      placeholder="e.g., Professional, Friendly, Authoritative"
                      disabled={flowLoading}
                      className="w-full px-4 py-3 bg-void-black border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
                      style={{ '--tw-ring-color': '#2F80FF' } as React.CSSProperties}
                    />
                  </div>
                )}

                {needsMode(activeFlow) && (
                  <div>
                    <label className="block text-sm font-medium text-cool-ash mb-2">
                      Midnight Mode *
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="mode"
                          value="homepage_edit"
                          checked={modeInput === "homepage_edit"}
                          onChange={(e) => setModeInput(e.target.value as 'homepage_edit' | 'route_to_crimson')}
                          disabled={flowLoading}
                          className="w-5 h-5"
                          style={{ accentColor: '#2F80FF' }}
                        />
                        <span>Homepage Edit</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="mode"
                          value="route_to_crimson"
                          checked={modeInput === "route_to_crimson"}
                          onChange={(e) => setModeInput(e.target.value as 'homepage_edit' | 'route_to_crimson')}
                          disabled={flowLoading}
                          className="w-5 h-5"
                          style={{ accentColor: '#2F80FF' }}
                        />
                        <span>Route to Crimson</span>
                      </label>
                    </div>
                  </div>
                )}

                {flowError && (
                  <div className="bg-red-600 border border-red-700 rounded-lg px-4 py-3">
                    <div className="text-white text-sm">{flowError}</div>
                  </div>
                )}

                {flowLoading && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2" style={{ borderColor: '#2F80FF' }}></div>
                    <p className="text-cool-ash text-sm">Running flow...</p>
                  </div>
                )}

                {flowResults && (
                  <div className="bg-void-black rounded-lg border border-steel-gray p-4">
                    <h3 className="text-lg font-bold mb-2">Results</h3>
                    <pre className="text-xs text-cool-ash overflow-auto max-h-64">
                      {JSON.stringify(flowResults, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={flowLoading}
                    className="flex-1 px-6 py-3 bg-[#2F80FF] hover:bg-[#2566cc] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {flowLoading ? "Running..." : "Run Flow"}
                  </button>
                  <button
                    type="button"
                    onClick={closeFlowModal}
                    disabled={flowLoading}
                    className="px-6 py-3 bg-obsidian border border-steel-gray hover:border-teal-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
