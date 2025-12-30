"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
// BrandLogo and HamburgerMenu are now in the layout
import type { MidnightAPIResponse, MidnightMode } from "@/lib/llms/types";

function AdminMidnightPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [mode, setMode] = useState<MidnightMode>("homepage_edit");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MidnightAPIResponse | null>(null);

  useEffect(() => {
    checkAdminAccess();
    
    // Pre-populate URL from query parameter
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setUrlInput(decodeURIComponent(urlParam));
    }
  }, [searchParams]);

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
    }
  };

  const handleRunMidnight = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const response = await fetch("/api/llm/midnight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: trimmedUrl,
          mode: mode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          setError(errorData.error || "Failed to execute Midnight. Please try again.");
        } else {
          const text = await response.text().catch(() => "Unknown error");
          const preview = text.substring(0, 200);
          setError(`Error ${response.status}: ${preview}`);
        }
        setLoading(false);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text().catch(() => "Invalid response");
        const preview = text.substring(0, 200);
        setError(`Invalid response format (expected JSON): ${preview}`);
        setLoading(false);
        return;
      }

      const responseData: MidnightAPIResponse = await response.json();
      setResults(responseData);
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
    <main className="min-h-[calc(100vh-200px)] px-6 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Link href="/admin" className="text-laser-blue hover:text-light-blue-tint">
                ← Back to Admin Dashboard
              </Link>
            </div>

            <h1 className="text-4xl font-bold mb-2">Midnight</h1>
            <p className="text-gray-400 text-sm mb-2">Midnight decides what kind of work should happen next.</p>
            <p className="text-cool-ash mb-8">
              Homepage structure and decision routing
            </p>

            <form onSubmit={handleRunMidnight} className="mb-8 space-y-4">
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
                <label className="block text-sm font-medium text-cool-ash mb-4">
                  Mode *
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="homepage_edit"
                      checked={mode === "homepage_edit"}
                      onChange={(e) => setMode(e.target.value as MidnightMode)}
                      disabled={loading}
                      className="w-5 h-5"
                      style={{ accentColor: '#2F80FF' }}
                    />
                    <div>
                      <div className="font-semibold">Homepage Edit</div>
                      <div className="text-sm text-cool-ash">Provides layout and structure guidance</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="route_to_crimson"
                      checked={mode === "route_to_crimson"}
                      onChange={(e) => setMode(e.target.value as MidnightMode)}
                      disabled={loading}
                      className="w-5 h-5"
                      style={{ accentColor: '#2F80FF' }}
                    />
                    <div>
                      <div className="font-semibold">Route to Crimson</div>
                      <div className="text-sm text-cool-ash">Determines what content should be edited and calls Crimson</div>
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-8 py-4 bg-[#2F80FF] hover:bg-[#2F80FF] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Running Midnight..." : "Run Midnight"}
              </button>
            </form>

            {error && (
              <div className="bg-red-600 border border-red-700 rounded-lg px-6 py-4 mb-8">
                <div className="text-white font-semibold mb-2">Error</div>
                <div className="text-red-100">{error}</div>
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
                <p className="text-cool-ash">Running Midnight analysis...</p>
              </div>
            )}

            {results && (
              <div className="space-y-6">
                {results.structureRecommendations.length > 0 && (
                  <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                    <h2 className="text-2xl font-bold mb-4">Structure Recommendations</h2>
                    <div className="space-y-4">
                      {results.structureRecommendations.map((rec, idx) => (
                        <div key={idx} className="border-b border-steel-gray pb-4 last:border-0">
                          <div className="font-semibold text-laser-blue mb-2">{rec.section}</div>
                          <div className="text-sm text-cool-ash mb-2">Current:</div>
                          <div className="bg-void-black p-3 rounded mb-2 text-cool-ash">{rec.currentStructure}</div>
                          <div className="text-sm text-cool-ash mb-2">Recommended:</div>
                          <div className="bg-void-black p-3 rounded mb-2 text-white">{rec.recommendedStructure}</div>
                          <div className="text-sm text-cool-ash italic mb-1">{rec.rationale}</div>
                          <div className="text-sm text-gray-500">Priority: {rec.priority}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.midnightActions.length > 0 && (
                  <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                    <h2 className="text-2xl font-bold mb-4">Action Items</h2>
                    <div className="space-y-2">
                      {results.midnightActions.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <span className="text-laser-blue mt-1">•</span>
                          <div>
                            <div className="font-semibold">{action.title}</div>
                            <div className="text-cool-ash text-sm">{action.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.optionalCrimsonArtifacts ? (
                  <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                    <p className="text-cool-ash mb-4">The structure looks solid. Improving page messaging may be the next best step.</p>
                    <button
                      onClick={() => {
                        const encodedUrl = encodeURIComponent(urlInput);
                        const encodedGoal = encodeURIComponent("Improve page messaging clarity and conversion based on Midnight diagnosis");
                        router.push(`/admin/crimson/create?url=${encodedUrl}&goal=${encodedGoal}`);
                      }}
                      className="w-full text-left px-6 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition"
                    >
                      <div className="font-semibold text-white mb-1">Refine page messaging</div>
                      <div className="text-sm text-gray-400">Continue to Crimson content optimization</div>
                    </button>
                  </div>
                ) : results.midnightActions.length > 0 && (
                  <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                    <p className="text-cool-ash mb-4">This page may benefit from structural adjustments before rewriting content.</p>
                    <div className="text-sm text-gray-400">Review the layout guidance above to understand the recommended structural changes.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
  );
}

export default function AdminMidnightPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[calc(100vh-200px)] px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
            <p className="text-cool-ash">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <AdminMidnightPageContent />
    </Suspense>
  );
}

