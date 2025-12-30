"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import HamburgerMenu from "@/components/HamburgerMenu";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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

      // Check role from user metadata
      const role = (user.user_metadata?.role as string) || 'VISITOR';
      if (role !== "ADMIN") {
        router.push("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-void-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
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
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">
              Admin Dashboard
            </h1>
            <p className="text-xl text-cool-ash text-center mb-12">
              Unified LLM SEO Decision System
            </p>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Run Audit Card */}
              <Link href="/admin/audit">
                <div className="bg-obsidian rounded-lg border border-steel-gray p-8 hover:border-teal-500 transition-colors cursor-pointer h-full">
                  <div className="text-3xl font-bold mb-4" style={{ color: '#2F80FF' }}>
                    1. Run Audit
                  </div>
                  <p className="text-cool-ash mb-4">
                    Baseline diagnostics and scoring using Peach audit engine
                  </p>
                  <div className="text-sm text-cool-ash">
                    <p className="mb-2">• Paste URL</p>
                    <p className="mb-2">• Run audit</p>
                    <p>• View report</p>
                  </div>
                </div>
              </Link>

              {/* Crimson Card */}
              <Link href="/admin/crimson">
                <div className="bg-obsidian rounded-lg border border-steel-gray p-8 hover:border-teal-500 transition-colors cursor-pointer h-full">
                  <div className="text-3xl font-bold mb-4" style={{ color: '#2F80FF' }}>
                    2. Crimson
                  </div>
                  <p className="text-cool-ash mb-4">
                    Edit and optimize page content for clarity, trust, and conversion
                  </p>
                  <div className="text-sm text-cool-ash">
                    <p className="mb-2">• URL input</p>
                    <p className="mb-2">• Goal selector</p>
                    <p>• Tone preset</p>
                  </div>
                </div>
              </Link>

              {/* Midnight Card */}
              <Link href="/admin/midnight">
                <div className="bg-obsidian rounded-lg border border-steel-gray p-8 hover:border-teal-500 transition-colors cursor-pointer h-full">
                  <div className="text-3xl font-bold mb-4" style={{ color: '#2F80FF' }}>
                    3. Midnight
                  </div>
                  <p className="text-cool-ash mb-4">
                    Homepage structure and decision routing
                  </p>
                  <div className="text-sm text-cool-ash">
                    <p className="mb-2">• Homepage edit mode</p>
                    <p className="mb-2">• Route to Crimson mode</p>
                    <p>• Structure recommendations</p>
                  </div>
                </div>
              </Link>

              {/* Burnt Card */}
              <Link href="/admin/burnt">
                <div className="bg-obsidian rounded-lg border border-steel-gray p-8 hover:border-teal-500 transition-colors cursor-pointer h-full">
                  <div className="text-3xl font-bold mb-4" style={{ color: '#2F80FF' }}>
                    4. Burnt
                  </div>
                  <p className="text-cool-ash mb-4">
                    Prioritize actions into an execution order
                  </p>
                  <div className="text-sm text-cool-ash">
                    <p className="mb-2">• Score Actions tab</p>
                    <p className="mb-2">• Full Run tab</p>
                    <p>• Prioritized action list</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

