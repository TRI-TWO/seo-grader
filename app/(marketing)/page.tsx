"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check if user is admin and redirect to /admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          setIsAdmin(false);
          return;
        }

        // Check if user is admin by email
        if (user.email === 'mgr@tri-two.com') {
          // Redirect admin users to /admin instead of showing AdminLauncher
          router.push("/admin");
          return;
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [router]);

  const handleUrlSubmit = async (e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout (API has 25s max)
    
    try {
      // POST to /api/audit to execute audit synchronously
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
        console.error("Error executing audit:", errorData);
        setError(errorData.error || "Failed to execute audit. Please try again.");
        setLoading(false);
        return;
      }

      const responseData = await response.json();
      console.log("API response:", responseData);
      
      const auditResults = responseData.results;
      if (!auditResults) {
        console.error("No results returned from API. Response:", responseData);
        setError("Failed to execute audit. Please try again.");
        setLoading(false);
        return;
      }

      console.log("Results received:", {
        hasSeoScore: !!auditResults.seoScore,
        hasTitleScore: !!auditResults.titleScoreRaw,
        hasMediaScore: !!auditResults.mediaScoreRaw,
        hasAiScore: !!auditResults.aiScoreRaw,
        partialAudit: auditResults.partialAudit,
      });

      // Store results in localStorage and navigate to report page
      if (typeof window !== 'undefined') {
        try {
          // Store in localStorage synchronously
          localStorage.setItem('auditResults', JSON.stringify(auditResults));
          
          // Verify it was stored
          const stored = localStorage.getItem('auditResults');
          if (!stored) {
            throw new Error("Failed to verify localStorage write");
          }
          
          console.log("Results stored in localStorage, navigating to report...");
          console.log("Stored data length:", stored.length);
          
          // Use window.location for full page navigation to ensure localStorage is available
          window.location.href = '/report';
        } catch (err) {
          console.error("Error storing results in localStorage:", err);
          setError("Failed to store results. Please try again.");
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Error submitting URL:", err);
      setLoading(false);
      if (err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("An error occurred. Please try again.");
      }
    }
  };

  // Show loading state while checking admin status
  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-void-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 border-laser-blue"></div>
          <p className="text-cool-ash">Loading...</p>
        </div>
      </div>
    );
  }

  // Show free audit hero for non-admin users
  return (
    <>
      {/* Content block - Centered, upper 60% safe zone */}
      <div className="mt-[5px] flex justify-center min-h-[60vh] items-center">
        <div className="flex flex-col gap-6 items-center max-w-4xl px-6">
          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-center uppercase" style={{ fontFamily: 'system-ui, sans-serif' }}>
            CLARITY. CONFIDENCE. CONTROL.
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-cool-ash text-center font-medium">
            Precision SEO platform for technical evaluation and optimization
          </p>

          {/* URL Input Section */}
          <form onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleUrlSubmit(e);
          }} className="flex flex-col sm:flex-row gap-4 max-w-2xl w-full" noValidate>
            <input
              type="text"
              placeholder="Enter your URL here..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUrlSubmit(e);
                }
              }}
              disabled={loading}
              className="flex-1 px-6 py-4 bg-obsidian border border-steel-gray rounded-lg text-white placeholder-cool-ash focus:outline-none focus:ring-2 focus:border-laser-blue disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ '--tw-ring-color': '#2F80FF' } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={handleUrlSubmit}
              disabled={loading}
              className="px-8 py-4 bg-laser-blue hover:bg-opacity-90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Free"}
            </button>
          </form>
          
          {/* Loading State */}
          {loading && (
            <div className="mt-4 text-center">
              <div className="text-xl text-cool-ash mb-4">Running SEO audit...</div>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-laser-blue"></div>
              </div>
              <div className="text-cool-ash text-sm mt-4">This may take up to 25 seconds</div>
            </div>
          )}
          
          {/* Error State */}
          {error && !loading && (
            <div className="mt-4 max-w-2xl w-full">
              <div className="bg-critical-red border border-critical-red rounded-lg px-6 py-4">
                <div className="text-white font-semibold mb-2">Error</div>
                <div className="text-white opacity-90">{error}</div>
              </div>
            </div>
          )}

          {/* Pricing / Tier Section */}
          <div className="mt-4 w-full max-w-6xl">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Left Card - Red */}
              <div className="flex-1 bg-red-500 rounded-lg p-6 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">$299 Starter</div>
                  <div className="text-red-100 text-sm">$299 Check</div>
                </div>
                <div className="w-10 h-10 text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 2.98.97 4.29l1.5-1.5C4.17 14.3 4 13.18 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8c0 1.18-.17 2.3-.47 3.29l1.5 1.5C21.64 14.98 22 13.54 22 12c0-5.52-4.48-10-10-10zm0 18c-1.38 0-2.63-.56-3.54-1.46L12 17l3.54 1.54C14.63 19.44 13.38 20 12 20z"/>
                    <circle cx="9" cy="12" r="1.5"/>
                    <circle cx="15" cy="12" r="1.5"/>
                  </svg>
                </div>
              </div>

              {/* Middle Card - Yellow */}
              <div className="flex-1 bg-yellow-500 rounded-lg p-6 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">$499 Growth</div>
                  <div className="text-yellow-100 text-sm">Deep Analysis</div>
                </div>
              </div>

              {/* Right Card - Teal */}
              <div className="flex-1 bg-teal-500 rounded-lg p-6 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">$699 Enterprise</div>
                  <div className="text-teal-100 text-sm">Custom Solutions</div>
                </div>
                <div className="w-10 h-10 text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                    <rect x="6" y="8" width="2" height="2" fill="currentColor"/>
                    <rect x="6" y="11" width="2" height="2" fill="currentColor"/>
                    <rect x="6" y="14" width="2" height="2" fill="currentColor"/>
                    <rect x="16" y="8" width="2" height="2" fill="currentColor"/>
                    <rect x="16" y="11" width="2" height="2" fill="currentColor"/>
                    <rect x="16" y="14" width="2" height="2" fill="currentColor"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

