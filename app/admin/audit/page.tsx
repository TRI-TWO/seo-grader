"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import HamburgerMenu from "@/components/HamburgerMenu";

export default function AdminAuditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

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

  const handleRunAudit = async (e: React.FormEvent) => {
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
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        setError(errorData.error || "Failed to execute audit. Please try again.");
        setLoading(false);
        return;
      }

      const responseData = await response.json();
      setResults(responseData.results);
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
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Link href="/admin" className="text-laser-blue hover:text-light-blue-tint">
                ← Back to Admin Dashboard
              </Link>
            </div>

            <h1 className="text-4xl font-bold mb-4">Run Audit</h1>
            <p className="text-cool-ash mb-8">
              Baseline diagnostics and scoring using Peach audit engine
            </p>

            <form onSubmit={handleRunAudit} className="mb-8">
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Enter URL here..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={loading}
                  className="flex-1 px-6 py-4 bg-obsidian border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
                  style={{ '--tw-ring-color': '#2F80FF' } as React.CSSProperties}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-4 bg-[#2F80FF] hover:bg-[#2F80FF] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Running..." : "Run Audit"}
                </button>
              </div>
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
                <p className="text-cool-ash">Running SEO audit...</p>
                <p className="text-cool-ash text-sm mt-2">This may take up to 25 seconds</p>
              </div>
            )}

            {results && (
              <div className="bg-obsidian rounded-lg border border-steel-gray p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4">Audit Results</h2>
                <div className="space-y-4">
                  <div>
                    <span className="text-cool-ash">SEO Score: </span>
                    <span className="text-white font-semibold">{results.seoScore || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-cool-ash">Title Score: </span>
                    <span className="text-white font-semibold">{results.titleScore10 || 'N/A'}/10</span>
                  </div>
                  <div>
                    <span className="text-cool-ash">Media Score: </span>
                    <span className="text-white font-semibold">{results.mediaScore10 || 'N/A'}/10</span>
                  </div>
                  <div>
                    <span className="text-cool-ash">AI Score: </span>
                    <span className="text-white font-semibold">{results.aiScore10 || 'N/A'}/10</span>
                  </div>
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('auditResults', JSON.stringify(results));
                        window.location.href = '/report';
                      }
                    }}
                    className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    View Full Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

