"use client";

import React from "react";
import BrandLogo from "@/app/components/BrandLogo";
import LogoutButton from "@/app/components/LogoutButton";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050810] text-white">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(6,182,212,0.12),transparent_50%),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(59,130,246,0.06),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <div className="relative z-10">
        <header className="relative border-b border-cyan-500/10 bg-slate-950/70 backdrop-blur-md">
          <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-[25px] py-2">
            <div className="justify-self-start">
              <BrandLogo size={132} className="leading-none" />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-400/80">
                TRI-TWO
              </p>
              <h1 className="text-sm font-semibold tracking-wide text-white sm:text-base">
                Admin Portal
              </h1>
            </div>
            <div className="justify-self-end flex items-center gap-2">
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="relative">{children}</main>
      </div>
    </div>
  );
}

