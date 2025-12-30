"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
// BrandLogo and HamburgerMenu are now in the layout
import type { CrimsonAPIResponse } from "@/lib/llms/types";

// Template data for goal generation
const TEMPLATE_GOALS: Record<string, string> = {
  seo_blog_post: "Create or refine long-form content optimized for search, focusing on clarity, trust, and conversion.",
  listicle: "Turn a topic into scannable, ranked sections with strong SEO structure and clear messaging.",
  local_service_page: "Improve a local landing page for relevance, trust, and conversion.",
  product_landing_page: "Optimize product messaging, benefits, and conversion CTAs.",
  email_campaign: "Generate or improve email copy aligned with your objective.",
  seo_audit_summary: "Turn findings into client-friendly summaries and next steps.",
  social_media_thread: "Convert ideas into a structured thread optimized for engagement.",
  how_to_guide: "Create step-by-step guidance content that ranks and converts.",
};

function AdminCrimsonCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [goal, setGoal] = useState("");
  const [tonePreset, setTonePreset] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CrimsonAPIResponse | null>(null);
  const [showStepIndicator, setShowStepIndicator] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    
    // Pre-populate URL and goal from query parameters
    const urlParam = searchParams.get('url');
    const goalParam = searchParams.get('goal');
    const contentTypeParam = searchParams.get('contentType');
    
    if (urlParam) {
      setUrlInput(decodeURIComponent(urlParam));
    }
    
    // Goal auto-fill logic: contentType > goal param > empty
    if (contentTypeParam && TEMPLATE_GOALS[contentTypeParam]) {
      setGoal(TEMPLATE_GOALS[contentTypeParam]);
      setShowStepIndicator(true);
    } else if (goalParam) {
      setGoal(decodeURIComponent(goalParam));
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

  const handleRunCrimson = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl || !goal.trim()) {
      setError("Please enter both URL and goal");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const response = await fetch("/api/llm/crimson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: trimmedUrl,
          goal: goal.trim(),
          tonePreset: tonePreset.trim() || undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          setError(errorData.error || "Failed to execute Crimson. Please try again.");
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

      const responseData: CrimsonAPIResponse = await response.json();
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

        {showStepIndicator && (
          <div className="mb-6 text-sm text-gray-400">
            Step 2 of 2: Confirm URL and goal
          </div>
        )}

        <h1 className="text-4xl font-bold mb-2">Crimson</h1>
        <p className="text-gray-400 text-sm mb-2">Crimson improves what the page says based on your goal.</p>
        <p className="text-cool-ash mb-8">
          Edit and optimize page content for clarity, trust, and conversion
        </p>

        <form onSubmit={handleRunCrimson} className="mb-8 space-y-4">
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
            <label className="block text-sm font-medium text-cool-ash mb-2">
              Goal *
            </label>
            <textarea
              placeholder="e.g., Increase conversions, improve trust signals, clarify messaging..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={loading}
              rows={3}
              className="w-full px-6 py-4 bg-obsidian border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
              style={{ '--tw-ring-color': '#2F80FF' } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cool-ash mb-2">
              Tone Preset (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Professional, Friendly, Authoritative"
              value={tonePreset}
              onChange={(e) => setTonePreset(e.target.value)}
              disabled={loading}
              className="w-full px-6 py-4 bg-obsidian border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
              style={{ '--tw-ring-color': '#2F80FF' } as React.CSSProperties}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-8 py-4 bg-[#2F80FF] hover:bg-[#2F80FF] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Running Crimson..." : "Run Crimson"}
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
            <p className="text-cool-ash">Running Crimson analysis...</p>
          </div>
        )}

        {results && (
          <div className="space-y-6">
            {results.contentEdits.length > 0 && (
              <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                <h2 className="text-2xl font-bold mb-4">Content Edits</h2>
                <div className="space-y-4">
                  {results.contentEdits.map((edit, idx) => (
                    <div key={idx} className="border-b border-steel-gray pb-4 last:border-0">
                      <div className="font-semibold text-laser-blue mb-2">{edit.section}</div>
                      <div className="text-sm text-cool-ash mb-2">Original:</div>
                      <div className="bg-void-black p-3 rounded mb-2 text-cool-ash">{edit.original}</div>
                      <div className="text-sm text-cool-ash mb-2">Edited:</div>
                      <div className="bg-void-black p-3 rounded mb-2 text-white">{edit.edited}</div>
                      <div className="text-sm text-cool-ash italic">{edit.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.ctaSuggestions.length > 0 && (
              <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                <h2 className="text-2xl font-bold mb-4">CTA Suggestions</h2>
                <div className="space-y-4">
                  {results.ctaSuggestions.map((cta, idx) => (
                    <div key={idx} className="border-b border-steel-gray pb-4 last:border-0">
                      <div className="font-semibold text-laser-blue mb-2">{cta.location}</div>
                      <div className="bg-void-black p-3 rounded mb-2 text-white">{cta.text}</div>
                      <div className="text-sm text-cool-ash mb-1">Style: {cta.style}</div>
                      <div className="text-sm text-cool-ash italic">{cta.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.crimsonActions.length > 0 && (
              <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                <h2 className="text-2xl font-bold mb-4">Action Items</h2>
                <div className="space-y-2">
                  {results.crimsonActions.map((action, idx) => (
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

            {/* Suggested next steps section */}
            {results.crimsonActions.length > 0 && (
              <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
                <h2 className="text-2xl font-bold mb-4">Suggested next steps</h2>
                <button
                  onClick={() => {
                    // Format actions as: "Title: Description on {url}"
                    const formattedActions = results.crimsonActions.map(action => 
                      `${action.title}: ${action.description} on ${urlInput}`
                    ).join('\n');
                    const encodedActions = encodeURIComponent(formattedActions);
                    router.push(`/admin/burnt?tab=score&actions=${encodedActions}`);
                  }}
                  className="w-full text-left px-6 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition"
                >
                  <div className="font-semibold text-white mb-1">Organize these recommendations</div>
                  <div className="text-sm text-gray-400">Create an execution order for the changes</div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminCrimsonCreatePage() {
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
      <AdminCrimsonCreatePageContent />
    </Suspense>
  );
}

