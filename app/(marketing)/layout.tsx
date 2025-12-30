"use client";

import React from "react";
import BrandLogo from "@/components/BrandLogo";
import HamburgerMenu from "@/components/HamburgerMenu";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-void-black text-white relative overflow-hidden">
      {/* Abstract data landscape background - Wave/Topographic */}
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
              <BrandLogo />
            </div>

            {/* Hamburger Menu - Right justified */}
            <div className="flex-shrink-0">
              <HamburgerMenu />
            </div>
          </div>
        </header>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}

