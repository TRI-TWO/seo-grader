"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import HamburgerMenu from "@/components/HamburgerMenu";

type TabType = "home" | "pricing" | "about";

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle browser back button for pricing tab
  useEffect(() => {
    const handlePopState = () => {
      if (activeTab === "pricing") {
        setActiveTab("home");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeTab]);

  // Handle pricing navigation from hamburger menu
  useEffect(() => {
    const handleNavigateToPricing = () => {
      setActiveTab("pricing");
    };

    window.addEventListener('navigateToPricing', handleNavigateToPricing);
    return () => window.removeEventListener('navigateToPricing', handleNavigateToPricing);
  }, []);

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

  return (
    <div className="min-h-screen bg-void-black text-white relative overflow-hidden">
      {/* Abstract data landscape background */}
      <div className="absolute inset-0">
        {/* Base dark background */}
        <div className="absolute inset-0 bg-void-black"></div>
        
        {/* Topographic lines - soft wave/grid data surface */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <defs>
            <linearGradient id="topoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2F80FF" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#2F80FF" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {/* Faint topographic contour lines */}
          <path d="M0,600 Q300,550 600,580 T1200,600" stroke="#2F80FF" strokeWidth="1" fill="none" opacity="0.15" />
          <path d="M0,650 Q300,600 600,630 T1200,650" stroke="#2F80FF" strokeWidth="1" fill="none" opacity="0.12" />
          <path d="M0,700 Q300,650 600,680 T1200,700" stroke="#2F80FF" strokeWidth="1" fill="none" opacity="0.1" />
          {/* Grid data surface */}
          <g opacity="0.08">
            {Array.from({ length: 15 }).map((_, i) => (
              <line key={`h-${i}`} x1="0" y1={i * 50} x2="1200" y2={i * 50} stroke="#2F80FF" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 20 }).map((_, i) => (
              <line key={`v-${i}`} x1={i * 60} y1="0" x2={i * 60} y2="800" stroke="#2F80FF" strokeWidth="0.5" />
            ))}
          </g>
        </svg>
        
        {/* Thin laser-blue path lines */}
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M100,400 Q400,300 700,350 T1200,400" stroke="#2F80FF" strokeWidth="1.5" fill="none" opacity="0.4" />
          <path d="M200,500 Q500,450 800,480 T1200,500" stroke="#2F80FF" strokeWidth="1" fill="none" opacity="0.3" />
        </svg>
        
        {/* Sparse mint node dots */}
        <div className="absolute inset-0">
          {Array.from({ length: 12 }).map((_, i) => {
            const x = Math.random() * 100;
            const y = 60 + Math.random() * 40; // Lower 40% of screen
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
        {/* Header */}
        <header className="px-6 py-2 md:px-12 md:py-3">
          <div className="flex items-start justify-between">
            {/* Logo - Fully left justified */}
            <div className="flex-shrink-0">
              <Logo />
            </div>

            {/* Hamburger Menu - Right justified */}
            <div className="flex-shrink-0">
              <HamburgerMenu />
            </div>
          </div>
        </header>

        {/* Content block - Centered, upper 60% safe zone */}
        <div className="mt-[5px] flex justify-center min-h-[60vh] items-center">
          <div className="flex flex-col gap-6 items-center max-w-4xl px-6">
            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-center uppercase" style={{ fontFamily: 'system-ui, sans-serif' }}>
              EVALUATE SYSTEMS, NOT GUESSES
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
                <div className="bg-red-600 border border-red-700 rounded-lg px-6 py-4">
                  <div className="text-white font-semibold mb-2">Error</div>
                  <div className="text-red-100">{error}</div>
                </div>
              </div>
            )}

            {/* Pricing / Tier Section */}
            <div className="mt-4 w-full max-w-6xl">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Left Card - Red */}
                <div className="flex-1 bg-red-500 rounded-lg p-6 flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">$299 Base</div>
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

                {/* Middle Card - Orange */}
                <div className="flex-1 bg-orange-500 rounded-lg p-6 flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">$499 Pro Tier</div>
                    <div className="text-orange-100 text-sm">Deep Analysis</div>
                  </div>
                </div>

                {/* Right Card - Green */}
                <div className="flex-1 rounded-lg p-6 flex items-center justify-between bg-mint-signal">
                  <div>
                    <div className="text-2xl font-bold">$699 Enterprise</div>
                    <div className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Custom Solutions</div>
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

        {/* Main Content - Tab-based */}
        <main className="min-h-[calc(100vh-200px)] px-6 py-12">
          {activeTab === "home" && (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
              {/* Home tab content is now in header */}
            </div>
          )}

          {activeTab === "pricing" && (
            <div className="max-w-7xl mx-auto space-y-12">
              {/* Tier Cards Section */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Base Plan */}
                <div className="bg-red-500 rounded-lg p-8 flex flex-col">
                  <div className="mb-6">
                    <div className="text-3xl font-bold mb-2">$299</div>
                    <div className="text-xl font-semibold text-white mb-2">Base Tier</div>
                    <div className="text-lg font-medium text-red-100 mb-3">Essential Monthly Local SEO Maintenance</div>
                    <p className="text-red-100 text-sm leading-relaxed">
                      Designed for contractors who need consistent visibility without heavy content or link work.
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <div className="text-white font-semibold mb-3">Monthly Work Included</div>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Technical SEO health scan</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Google Search Console review</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Indexing & crawl error monitoring</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Local keyword position tracking (core services only)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">On-page optimization for 1 page/month</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Title tag & meta description optimization</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Internal linking cleanup</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Google Business Profile optimization (if applicable)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Monthly SEO score update</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Monthly priority action list</span>
                      </li>
                    </ul>
                  </div>

                  <button className="w-full py-3 bg-white hover:bg-gray-100 text-red-500 font-semibold rounded-lg transition-colors">
                    Get Started
                  </button>
                </div>

                {/* Pro Plan */}
                <div className="bg-orange-500 rounded-lg p-8 flex flex-col">
                  <div className="mb-6">
                    <div className="text-3xl font-bold mb-2">$499</div>
                    <div className="text-xl font-semibold text-white mb-2">Pro Tier</div>
                    <div className="text-lg font-medium text-orange-100 mb-3">Growth-Focused SEO for Competitive Markets</div>
                    <p className="text-orange-100 text-sm leading-relaxed">
                      For businesses actively trying to rank over competitors and expand service visibility.
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <div className="text-white font-semibold mb-3">Everything in Base, plus:</div>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">On-page optimization for 2–3 pages/month</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Local landing page content optimization</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Conversion-focused SEO adjustments</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Image optimization & alt tagging</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Structured data (basic schema)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Local competitor tracking</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Search intent alignment updates</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Monthly SEO opportunity mapping</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Expanded keyword tracking (by service + city)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Monthly performance breakdown report</span>
                      </li>
                    </ul>
                  </div>

                  <button className="w-full py-3 bg-white hover:bg-gray-100 text-orange-500 font-semibold rounded-lg transition-colors">
                    Get Started
                  </button>
                </div>

                {/* Enterprise Plan */}
                <div className="rounded-lg p-8 flex flex-col bg-mint-signal">
                  <div className="mb-6">
                    <div className="text-3xl font-bold mb-2">$699</div>
                    <div className="text-xl font-semibold text-white mb-2">Enterprise Tier</div>
                    <div className="text-lg font-medium mb-3" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Regional SEO + Multi-Location Dominance</div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                      Built for companies expanding into multiple cities or running multiple service divisions.
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <div className="text-white font-semibold mb-3">Everything in Pro, plus:</div>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Multi-location SEO tracking</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Regional keyword heat-mapping</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">On-page optimization for 4–5 pages/month</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Advanced internal linking architecture</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">High-intent service page engineering</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Conversion rate optimization (light CRO)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Local backlink opportunity targeting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Market gap analysis</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Cross-city ranking strategy</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">Advanced technical audits</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-white mt-1">✓</span>
                        <span className="text-white text-sm">SEO revenue projection insights</span>
                      </li>
                    </ul>
                  </div>

                  <button className="w-full py-3 bg-white hover:bg-gray-100 font-semibold rounded-lg transition-colors text-mint-signal">
                    Contact Sales
                  </button>
                </div>
              </div>

              {/* Comparison Table Section */}
              <div className="mt-16">
                <h3 className="text-3xl md:text-4xl font-bold mb-8 text-center">Compare Features</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="bg-purple-600 text-left p-4 text-white font-semibold sticky left-0 z-10">Feature</th>
                        <th className="bg-purple-600 text-center p-4 text-white font-semibold min-w-[180px]">Base<br />$299</th>
                        <th className="bg-purple-600 text-center p-4 text-white font-semibold min-w-[180px]">Pro<br />$499</th>
                        <th className="bg-purple-600 text-center p-4 text-white font-semibold min-w-[180px]">Enterprise<br />$699</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-obsidian">
                        <td className="p-4 text-cool-ash sticky left-0 z-10 bg-obsidian">SEO Health Monitoring</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-steel-gray">
                        <td className="p-4 text-cool-ash sticky left-0 z-10 bg-steel-gray">Google Indexing & Crawl Checks</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">Monthly SEO Score</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">Keyword Rank Tracking</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">Google Business Profile Optimization</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">On-Page SEO Optimization</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">Title & Meta Optimization</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">Internal Linking Optimization</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">Image Alt & Media SEO</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">Conversion Path Optimization</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">Local Landing Page Optimization</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">Structured Data (Schema)</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">Competitor Tracking</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">SEO Opportunity Forecasting</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">Multi-Location SEO</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">Regional Keyword Heatmaps</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">Backlink Opportunity Mapping</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">Advanced Technical Audits</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">SEO Revenue Projection</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">Monthly Action Plan</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-900">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-900">Monthly Performance Report</td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                      <tr className="bg-zinc-800">
                        <td className="p-4 text-gray-300 sticky left-0 z-10 bg-zinc-800">AI SEO Analyst (Insight Engine)</td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-red-500 text-2xl">❌</span></td>
                        <td className="p-4 text-center"><span className="text-green-500 text-2xl">✅</span></td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-zinc-800">
                        <td className="p-4 sticky left-0 z-10 bg-zinc-800"></td>
                        <td className="p-4 text-center">
                          <button className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors">
                            Get Started
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors">
                            Get Started
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button className="w-full py-3 text-white font-semibold rounded-lg transition-colors bg-mint-signal hover:bg-opacity-90">
                            Contact Sales
                          </button>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* Bottom-right star icon */}
        <div className="absolute bottom-4 right-4 w-6 h-6 text-white opacity-30">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

