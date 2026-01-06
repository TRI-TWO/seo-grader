"use client";

import React from "react";
import BrandLogo from "@/app/components/BrandLogo";
import HamburgerMenu from "@/app/components/HamburgerMenu";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-void-black text-white relative overflow-hidden">
      {/* Charcoal background with diagonal pattern */}
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
        <header className="bg-void-black flex items-center justify-between px-6 py-4 md:px-12 md:py-6">
          <div className="flex-shrink-0">
            <BrandLogo />
          </div>
          <div className="flex-shrink-0">
            <HamburgerMenu />
          </div>
        </header>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}

