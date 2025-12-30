"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AboutPage() {
  const router = useRouter();

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      // If there's history, let browser handle it naturally
      // Otherwise navigate to home
      if (window.history.length <= 1) {
        router.push("/");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  return (
    <>
      {/* Main Content */}
      <main className="min-h-[calc(100vh-200px)] px-6 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-8">About Us</h1>
          </div>

          <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
            <p>
              We're a regional SEO company focused on helping service businesses get discovered by the people actively searching for them.
            </p>

            <p>
              Our platform uses a robust SEO scoring system to measure how well your website is indexed, ranked, and surfaced to real customers — not just search engines. Every score is tied to clear, actionable improvements so you always know what's helping or hurting your visibility.
            </p>

            <p>
              Behind the platform is a founder with 10 years of hands-on remodeling experience and 3 years of performance marketing and analytics experience. That means we understand both sides of the business: how the work actually happens in the field, and how customers find you online.
            </p>

            <div className="pt-6">
              <p className="text-xl font-semibold text-white mb-4">Our goal is simple:</p>
              <p className="text-xl">
                More visibility. More calls. More qualified leads.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom-right star icon */}
      <div className="absolute bottom-4 right-4 w-6 h-6 text-white opacity-30">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </div>
    </>
  );
}

