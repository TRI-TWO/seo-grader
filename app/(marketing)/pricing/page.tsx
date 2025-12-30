"use client";

import React from "react";

export default function PricingPage() {
  return (
    <main className="min-h-[calc(100vh-200px)] px-6 py-12">
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
          <div className="bg-yellow-500 rounded-lg p-8 flex flex-col">
            <div className="mb-6">
              <div className="text-3xl font-bold mb-2">$499</div>
              <div className="text-xl font-semibold text-white mb-2">Pro Tier</div>
              <div className="text-lg font-medium text-yellow-100 mb-3">Growth-Focused SEO for Competitive Markets</div>
              <p className="text-yellow-100 text-sm leading-relaxed">
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

            <button className="w-full py-3 bg-white hover:bg-gray-100 text-yellow-500 font-semibold rounded-lg transition-colors">
              Get Started
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="rounded-lg p-8 flex flex-col bg-teal-500">
            <div className="mb-6">
              <div className="text-3xl font-bold mb-2">$699</div>
              <div className="text-xl font-semibold text-white mb-2">Enterprise Tier</div>
              <div className="text-lg font-medium text-teal-100 mb-3">Regional SEO + Multi-Location Dominance</div>
              <p className="text-teal-100 text-sm leading-relaxed">
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
                <th className="bg-steel-gray text-left p-4 text-white font-semibold sticky left-0 z-10">Feature</th>
                <th className="bg-steel-gray text-center p-4 text-white font-semibold min-w-[180px]">Base<br />$299</th>
                <th className="bg-steel-gray text-center p-4 text-white font-semibold min-w-[180px]">Pro<br />$499</th>
                <th className="bg-steel-gray text-center p-4 text-white font-semibold min-w-[180px]">Enterprise<br />$699</th>
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
                    <button className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-colors">
                      Get Started
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    <button className="w-full py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors">
                      Contact Sales
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

