"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  runAuditToBurnt,
  runBurntOrchestrate,
} from "@/lib/adminFlows";

const tiles = [
  {
    id: 'audit',
    label: 'Audit',
    subtitle: 'SEO Scorer',
    color: '#f5c451',
    path: '/admin/audit',
    flows: ['audit-to-burnt'], // Audit → Burnt only (per CTA flow rules)
  },
  {
    id: 'crimson',
    label: 'Crimson',
    subtitle: 'Content Engine',
    color: '#e4572e',
    path: '/admin/crimson',
    flows: [], // Execution tools return to Client Database (no forward CTAs)
  },
  {
    id: 'midnight',
    label: 'Midnight',
    subtitle: 'Decision Engine',
    color: '#7bd389',
    path: '/admin/midnight',
    flows: [], // Execution tools return to Client Database (no forward CTAs)
  },
  {
    id: 'burnt',
    label: 'Burnt',
    subtitle: 'Prioritization',
    color: '#f29e4c',
    path: '/admin/burnt',
    flows: ['burnt-orchestrate'], // Burnt → Crimson/Midnight only
  },
  {
    id: 'smokey',
    label: 'Smokey',
    subtitle: 'Planner',
    color: '#4a5568',
    path: '/admin/smokey',
    flows: [],
  },
  {
    id: 'wildcat',
    label: 'Wildcat',
    subtitle: 'CRM',
    color: '#2F80FF',
    path: '/admin/wildcat',
    flows: [],
  },
  {
    id: 'arch',
    label: 'Arch',
    subtitle: 'Health',
    color: '#16b8a6',
    path: '/admin/arch',
    flows: [],
  },
  {
    id: 'local',
    label: 'Local',
    subtitle: 'Readiness + Maps',
    color: '#7c3aed',
    path: '/admin/local',
    flows: [],
  },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<'smokey' | 'wildcat' | null>(null);
  
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
    // Load persona from sessionStorage on mount
    if (typeof window !== 'undefined') {
      const storedPersona = sessionStorage.getItem('admin_persona');
      if (storedPersona === 'smokey' || storedPersona === 'wildcat') {
        setSelectedPersona(storedPersona);
      }
    }
  }, []);

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push("/login");
        return;
      }

      // Check if user is admin by email
      if (user.email !== 'mgr@tri-two.com') {
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

  const handleTileClick = (path: string, e: React.MouseEvent) => {
    // Primary action: navigate to tool
    if (e.button === 0 || e.type === 'click') {
      router.push(path);
    }
  };

  const handleTileRightClick = (tile: typeof tiles[0], e: React.MouseEvent) => {
    e.preventDefault();
    // Right-click opens flow selector if tile has flows
    if (tile.flows.length > 0) {
      // For now, open first flow. Could show a menu to select which flow
      openFlowModal(tile.flows[0]);
    }
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
        case 'audit-to-burnt':
          // Audit → Burnt (valid CTA flow)
          results = await runAuditToBurnt(trimmedUrl);
          break;
        
        case 'burnt-orchestrate':
          // Burnt → Crimson/Midnight (valid CTA flow)
          results = await runBurntOrchestrate(trimmedUrl);
          break;
        
        // Removed invalid flows per CTA flow rules:
        // - audit-to-crimson (Audit can only route to Burnt)
        // - audit-to-midnight (Audit can only route to Burnt)
        // - crimson-to-midnight (Execution tools return to Client Database)
        // - crimson-to-burnt (Execution tools return to Client Database)
        // - midnight-to-crimson (Execution tools return to Client Database)
        // - midnight-to-burnt (Execution tools return to Client Database)
        
        default:
          setFlowError("Unknown flow");
          setFlowLoading(false);
          return;
      }

      setFlowResults(results);
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
    // No flows currently require goal input (burnt-orchestrate handles it internally)
    return false;
  };

  const needsMode = (flowId: string) => {
    // No flows currently require mode input
    return false;
  };

  const handlePersonaSelect = (persona: 'smokey' | 'wildcat') => {
    setSelectedPersona(persona);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin_persona', persona);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom, #0b0f1a, #05070d)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: 'linear-gradient(to bottom, #0b0f1a, #05070d)' }}>
      {/* Wave overlay */}
      <div className="absolute inset-0 opacity-20">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <defs>
            <linearGradient id="adminTopoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2F80FF" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#2F80FF" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d="M0,600 Q300,550 600,580 T1200,600" stroke="#2F80FF" strokeWidth="1" fill="none" opacity="0.15" />
          <path d="M0,650 Q300,600 600,630 T1200,650" stroke="#2F80FF" strokeWidth="1" fill="none" opacity="0.12" />
          <path d="M0,700 Q300,650 600,680 T1200,700" stroke="#2F80FF" strokeWidth="1" fill="none" opacity="0.1" />
          <g opacity="0.08">
            {Array.from({ length: 15 }).map((_, i) => (
              <line key={`h-${i}`} x1="0" y1={i * 50} x2="1200" y2={i * 50} stroke="#2F80FF" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 20 }).map((_, i) => (
              <line key={`v-${i}`} x1={i * 60} y1="0" x2={i * 60} y2="800" stroke="#2F80FF" strokeWidth="0.5" />
            ))}
          </g>
        </svg>
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M100,400 Q400,300 700,350 T1200,400" stroke="#2F80FF" strokeWidth="1.5" fill="none" opacity="0.4" />
          <path d="M200,500 Q500,450 800,480 T1200,500" stroke="#2F80FF" strokeWidth="1" fill="none" opacity="0.3" />
        </svg>
        <div className="absolute inset-0">
          {Array.from({ length: 12 }).map((_, i) => {
            const x = Math.random() * 100;
            const y = 60 + Math.random() * 40;
            return (
              <div
                key={i}
                className="absolute rounded-full bg-mint-signal opacity-30"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: '4px',
                  height: '4px',
                  boxShadow: '0 0 6px rgba(46, 211, 183, 0.4)',
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="relative z-10">
        <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-6xl">
            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold mb-12 text-center text-white">
              ADMIN PAGE
            </h1>

            {/* Persona Selector Section */}
            <div className="mb-16">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-white mb-2">Operating Mode</h2>
                <p className="text-cool-ash text-sm max-w-2xl mx-auto">
                  Choose how you want to operate in the system. This affects context, visibility, and workflows — not data ownership.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-6">
                {/* Smokey Card */}
                <div
                  onClick={() => handlePersonaSelect('smokey')}
                  className={`cursor-pointer rounded-lg p-6 min-w-[280px] flex flex-col transition-all ${
                    selectedPersona === 'smokey' 
                      ? 'ring-2 ring-white ring-opacity-50 scale-105' 
                      : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: '#4a5568',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: selectedPersona === 'smokey' 
                      ? '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.3)' 
                      : '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div className="text-2xl font-bold text-white mb-1">
                    Smokey
                  </div>
                  <div className="text-sm text-white opacity-80 mb-3">
                    Internal Operator
                  </div>
                  <div className="text-xs text-white opacity-70">
                    Full system visibility. No paywalls. Diagnostic and build mode.
                  </div>
                </div>

                {/* Wildcat Card */}
                <div
                  onClick={() => handlePersonaSelect('wildcat')}
                  className={`cursor-pointer rounded-lg p-6 min-w-[280px] flex flex-col transition-all ${
                    selectedPersona === 'wildcat' 
                      ? 'ring-2 ring-white ring-opacity-50 scale-105' 
                      : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: '#2F80FF',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: selectedPersona === 'wildcat' 
                      ? '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.3)' 
                      : '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div className="text-2xl font-bold text-white mb-1">
                    Wildcat
                  </div>
                  <div className="text-sm text-white opacity-80 mb-3">
                    Client Perspective
                  </div>
                  <div className="text-xs text-white opacity-70">
                    Represents how a client would experience workflows and outputs.
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Tiles - Centered */}
            <div className="flex flex-wrap justify-center gap-8">
              {tiles.map((tile) => (
                <div
                  key={tile.id}
                  onClick={(e) => handleTileClick(tile.path, e)}
                  onContextMenu={(e) => handleTileRightClick(tile, e)}
                  className="cursor-pointer rounded-lg p-8 min-w-[200px] flex flex-col items-center justify-center transition-transform hover:scale-105"
                  style={{
                    backgroundColor: tile.color,
                    boxShadow: `0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)`,
                  }}
                >
                  <div className="text-3xl font-bold text-white mb-2">
                    {tile.label}
                  </div>
                  <div className="text-lg text-white opacity-90">
                    {tile.subtitle}
                  </div>
                  {tile.flows.length > 0 && (
                    <div className="mt-2 text-xs text-white opacity-70">
                      Right-click for flows
                    </div>
                  )}
                </div>
              ))}
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
