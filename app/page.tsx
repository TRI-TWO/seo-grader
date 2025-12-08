"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type TabType = "home" | "pricing" | "about";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [urlInput, setUrlInput] = useState("");
  const router = useRouter();

  const handleUrlSubmit = (e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      return;
    }
    const encodedUrl = encodeURIComponent(trimmedUrl);
    const reportUrl = `/report?url=${encodedUrl}`;
    console.log("Navigating to:", reportUrl);
    router.push(reportUrl);
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white relative overflow-hidden">
      {/* Geometric pattern background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.05) 35px, rgba(255,255,255,0.05) 70px)`,
        }}></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 md:px-12 md:py-6">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <span className="text-white text-6xl font-bold italic font-serif">TRI</span>
            <div className="relative w-64 h-64">
              {/* Three overlapping circles with outlined 2s - 4x size */}
              {/* Top-left circle (deep red/clay) - orange "2" */}
              <div className="absolute top-0 -left-[5px] w-40 h-40 bg-[#8B3A2E] rounded-full flex items-center justify-center z-20 shadow-lg">
                <span 
                  className="font-bold text-[5.625rem] leading-none"
                  style={{ 
                    WebkitTextStroke: '6px #D17130',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    fontFamily: 'sans-serif'
                  } as React.CSSProperties}
                >2</span>
              </div>
              {/* Top-right circle (burnt orange) - green/teal "2" */}
              <div className="absolute top-0 -right-[5px] w-40 h-40 bg-[#D17130] rounded-full flex items-center justify-center z-20 shadow-lg">
                <span 
                  className="font-bold text-[5.625rem] leading-none"
                  style={{ 
                    WebkitTextStroke: '6px #546D75',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    fontFamily: 'sans-serif'
                  } as React.CSSProperties}
                >2</span>
              </div>
              {/* Bottom-center circle (slate blue-grey) - red "2" */}
              <div className="absolute -bottom-[10px] left-1/2 transform -translate-x-1/2 w-40 h-40 bg-[#546D75] rounded-full flex items-center justify-center z-10 shadow-lg">
                <span 
                  className="font-bold text-[5.625rem] leading-none"
                  style={{ 
                    WebkitTextStroke: '6px #8B3A2E',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    fontFamily: 'sans-serif'
                  } as React.CSSProperties}
                >2</span>
              </div>
            </div>
            <span className="text-white text-6xl font-bold italic font-serif">TWO</span>
          </div>

          {/* Tab Navigation */}
          <nav className="flex items-center gap-4 md:gap-6">
            <button
              onClick={() => setActiveTab("home")}
              className={`px-4 py-2 text-5xl font-medium transition ${
                activeTab === "home"
                  ? "text-white border-b-2 border-teal-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveTab("pricing")}
              className={`px-4 py-2 text-5xl font-medium transition ${
                activeTab === "pricing"
                  ? "text-white border-b-2 border-teal-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Pricing
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`px-4 py-2 text-5xl font-medium transition ${
                activeTab === "about"
                  ? "text-white border-b-2 border-teal-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              About
            </button>
          </nav>
        </header>

        {/* Main Content - Tab-based */}
        <main className="min-h-[calc(100vh-200px)] px-6 py-12">
          {activeTab === "home" && (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
              <div className="text-center space-y-6 max-w-4xl">
                {/* Main Heading */}
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                  EMPOWER YOUR SEO
                </h1>

                {/* Subheading */}
                <p className="text-xl md:text-2xl text-gray-300">
                  CLARITY. CONFIDENCE. CONTROL.
                </p>

                {/* URL Input Section */}
                <form onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleUrlSubmit(e);
                }} className="flex flex-col sm:flex-row gap-4 mt-12 max-w-2xl mx-auto" noValidate>
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
                    className="flex-1 px-6 py-4 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={handleUrlSubmit}
                    className="px-8 py-4 bg-[#8B4513] hover:bg-[#A0522D] text-white font-semibold rounded-lg transition-colors"
                  >
                    Free
                  </button>
                </form>
              </div>

              {/* Pricing / Tier Section */}
              <div className="mt-16 w-full max-w-6xl mx-auto">
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

                  {/* Right Card - Teal */}
                  <div className="flex-1 bg-teal-500 rounded-lg p-6 flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">$899 Enterprise</div>
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
          )}

          {activeTab === "pricing" && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="text-center">
                <h2 className="text-4xl md:text-5xl font-bold mb-4">Choose Your Plan</h2>
                <p className="text-xl text-gray-300">Select the perfect SEO analysis package for your needs</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mt-12">
                {/* Base Plan */}
                <div className="border-2 border-red-500 bg-zinc-900 rounded-lg p-8 flex flex-col">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      UIT
                    </div>
                    <div>
                      <div className="text-3xl font-bold">$299</div>
                      <div className="text-gray-400 text-sm">Base</div>
                    </div>
                  </div>
                  <ul className="space-y-4 flex-1 mb-6">
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 mt-1">✓</span>
                      <span>Basic SEO audit</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 mt-1">✓</span>
                      <span>Title tag analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 mt-1">✓</span>
                      <span>Meta description check</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 mt-1">✓</span>
                      <span>H1 tag verification</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 mt-1">✓</span>
                      <span>Word count analysis</span>
                    </li>
                  </ul>
                  <button className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors">
                    Get Started
                  </button>
                </div>

                {/* Pro Plan */}
                <div className="bg-orange-500 rounded-lg p-8 flex flex-col">
                  <div className="mb-6">
                    <div className="text-3xl font-bold mb-2">$499</div>
                    <div className="text-orange-100 text-sm">Pro Tier</div>
                    <div className="text-orange-200 text-xs mt-1">Deep Analysis</div>
                  </div>
                  <ul className="space-y-4 flex-1 mb-6">
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Everything in Base</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Advanced technical audit</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Image optimization analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Link structure review</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Priority support</span>
                    </li>
                  </ul>
                  <button className="w-full py-3 bg-white hover:bg-gray-100 text-orange-500 font-semibold rounded-lg transition-colors">
                    Get Started
                  </button>
                </div>

                {/* Enterprise Plan */}
                <div className="bg-teal-500 rounded-lg p-8 flex flex-col">
                  <div className="mb-6">
                    <div className="text-3xl font-bold mb-2">$899</div>
                    <div className="text-teal-100 text-sm">Enterprise</div>
                    <div className="text-teal-200 text-xs mt-1">Custom Solutions</div>
                  </div>
                  <ul className="space-y-4 flex-1 mb-6">
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Everything in Pro</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Custom reporting</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Multi-page analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Dedicated account manager</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white mt-1">✓</span>
                      <span>Ongoing monitoring</span>
                    </li>
                  </ul>
                  <button className="w-full py-3 bg-white hover:bg-gray-100 text-teal-500 font-semibold rounded-lg transition-colors">
                    Contact Sales
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="text-center">
                <h2 className="text-4xl md:text-5xl font-bold mb-4">About Tri-Two SEO</h2>
                <p className="text-xl text-gray-300">Empowering businesses with clarity, confidence, and control</p>
              </div>

              <div className="space-y-6 text-gray-300">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">Our Mission</h3>
                  <p className="leading-relaxed">
                    At Tri-Two SEO, we believe that every business deserves to understand and optimize their online presence. 
                    Our mission is to provide clear, actionable insights that help you take control of your SEO strategy.
                  </p>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">What We Do</h3>
                  <p className="leading-relaxed">
                    We offer comprehensive SEO auditing tools that analyze your website's technical SEO, content quality, 
                    and optimization opportunities. From basic checks to deep analysis, we provide the insights you need 
                    to improve your search engine rankings.
                  </p>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">Why Choose Us</h3>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Comprehensive SEO analysis covering all critical factors</li>
                    <li>Clear, actionable recommendations</li>
                    <li>Fast and accurate results</li>
                    <li>Transparent pricing with no hidden fees</li>
                    <li>Expert support when you need it</li>
                  </ul>
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

