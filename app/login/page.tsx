"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/app/components/BrandLogo";
import HamburgerMenu from "@/app/components/HamburgerMenu";

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email === "mgr@tri-two.com" || email === "tri-two@mgr";
}

function safeInternalRedirectPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("://") || raw.includes("\\")) return fallback;
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || "Invalid email or password");
        setLoading(false);
      } else if (data.user) {
        const redirectParam =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("redirect")
            : null;
        const isAdmin = isAdminEmail(data.user.email);
        const adminTarget = safeInternalRedirectPath(
          redirectParam,
          "/admin"
        );
        const clientTarget = safeInternalRedirectPath(
          redirectParam,
          "/arch"
        );
        const nextPath = isAdmin
          ? adminTarget.startsWith("/admin")
            ? adminTarget
            : "/admin"
          : clientTarget.startsWith("/arch")
            ? clientTarget
            : "/arch";

        router.replace(nextPath);
        router.refresh();
      } else {
        setError("An error occurred. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

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
          <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2 sm:px-6">
            <div className="justify-self-start">
              <BrandLogo size={132} className="leading-none" />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-400/80">
                TRI-TWO
              </p>
              <h1 className="text-sm font-semibold tracking-wide text-white sm:text-base">
                Client Login
              </h1>
            </div>
            <div className="justify-self-end">
              <HamburgerMenu />
            </div>
          </div>
        </header>

        <main className="flex min-h-[calc(100vh-130px)] items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(6,182,212,0.06),0_20px_50px_-20px_rgba(0,0,0,0.7)]">
              <h1 className="text-3xl font-bold mb-6 text-center">
                Login
              </h1>

              <p className="text-gray-400 text-sm mb-6 text-center">
                Access restricted to authorized accounts only
              </p>

              {error && (
                <div className="bg-red-600 border border-red-700 rounded-lg px-4 py-3 mb-4">
                  <div className="text-white text-sm">{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#16b8a6' } as React.CSSProperties}
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#16b8a6' } as React.CSSProperties}
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#16b8a6' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#14a895'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16b8a6'}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/reset-password"
                  className="text-sm"
                  style={{ color: '#16b8a6' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#14a895'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#16b8a6'}
                >
                  Forgot your password?
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
