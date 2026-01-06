"use client";

import React from "react";
import Link from "next/link";
import BrandLogo from "@/app/components/BrandLogo";
import HamburgerMenu from "@/app/components/HamburgerMenu";

export default function AdminLauncher() {
  const cards = [
    {
      title: "Run an Audit",
      description: "Run the TRI-TWO audit engine and view scoring + actions.",
      href: "/admin/audit",
      cta: "Open Audit",
    },
    {
      title: "Crimson",
      description: "Content + strategy generation (Jasper-like).",
      href: "/admin/crimson",
      cta: "Open Crimson",
    },
    {
      title: "Midnight",
      description: "Homepage edits / builder workflows tied to audit insights.",
      href: "/admin/midnight",
      cta: "Open Midnight",
    },
    {
      title: "Burnt",
      description: "Glue layer + multi-agent orchestration and outputs.",
      href: "/admin/burnt",
      cta: "Open Burnt",
    },
  ];

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
        <header className="bg-void-black flex items-center justify-between px-6 py-4 md:px-12 md:py-6">
          <div className="flex-shrink-0">
            <BrandLogo />
          </div>
          <div className="flex-shrink-0">
            <HamburgerMenu />
          </div>
        </header>

        <main className="min-h-[calc(100vh-200px)] px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">
              Admin Dashboard
            </h1>
            <p className="text-xl text-cool-ash text-center mb-12">
              Unified LLM SEO Decision System
            </p>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {cards.map((card) => (
                <Link key={card.href} href={card.href}>
                  <div className="bg-obsidian rounded-lg border border-steel-gray p-8 hover:border-mint-signal transition-colors cursor-pointer h-full">
                    <div className="text-3xl font-bold mb-4 text-laser-blue">
                      {card.title}
                    </div>
                    <p className="text-cool-ash mb-4">
                      {card.description}
                    </p>
                    <div className="text-sm text-mint-signal font-semibold">
                      {card.cta} →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

