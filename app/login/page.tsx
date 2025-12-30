"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/app/components/BrandLogo";
import HamburgerMenu from "@/app/components/HamburgerMenu";

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
        // Check user email and redirect accordingly
        if (data.user.email === 'mgr@tri-two.com') {
          router.replace('/admin');
        } else {
          router.replace('/');
        }
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
    <div className="min-h-screen bg-zinc-900 text-white relative overflow-hidden">
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
          {/* Logo - Fully left justified */}
          <div className="flex-shrink-0">
            <BrandLogo />
          </div>

          {/* Hamburger Menu - Right justified */}
          <div className="flex-shrink-0">
            <HamburgerMenu />
          </div>
        </header>

        <main className="min-h-[calc(100vh-200px)] px-6 py-12 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-8">
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
