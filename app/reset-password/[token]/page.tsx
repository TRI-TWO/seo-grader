"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import HamburgerMenu from "@/components/HamburgerMenu";

export default function SetNewPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    // Supabase handles password reset tokens via URL hash fragments
    // Check if we have a valid session from the reset link
    const validateToken = async () => {
      try {
        const supabase = createClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          setError("Invalid or expired reset token");
          setValidating(false);
          return;
        }

        // If we have a session, the token is valid
        if (session) {
          setTokenValid(true);
        } else {
          setError("Invalid or expired reset token. Please request a new one.");
        }
      } catch (err) {
        setError("An error occurred while validating the token");
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || "Failed to update password. The reset link may have expired.");
        setLoading(false);
      } else {
        setSuccess(true);
        setLoading(false);
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-bold mb-4">Validating token...</div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
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

        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="w-full max-w-md">
            <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-8">
              <h1 className="text-3xl font-bold mb-6 text-center">
                Invalid Token
              </h1>
              {error && (
                <div className="bg-red-600 border border-red-700 rounded-lg px-4 py-3 mb-4">
                  <div className="text-white text-sm">{error}</div>
                </div>
              )}
              <Link
                href="/reset-password"
                className="block text-center text-sm"
                style={{ color: '#16b8a6' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#14a895'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#16b8a6'}
              >
                Request a new reset link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <Logo />
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
                Set New Password
              </h1>

              {success ? (
                <div className="space-y-4">
                  <div className="bg-green-600 border border-green-700 rounded-lg px-4 py-3">
                    <div className="text-white text-sm">
                      Password has been reset successfully! Redirecting to login...
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="bg-red-600 border border-red-700 rounded-lg px-4 py-3 mb-4">
                      <div className="text-white text-sm">{error}</div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-gray-300 mb-2"
                      >
                        New Password
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ '--tw-ring-color': '#16b8a6' } as React.CSSProperties}
                        placeholder="••••••••"
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Must be at least 8 characters
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-gray-300 mb-2"
                      >
                        Confirm Password
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
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
                      {loading ? "Resetting..." : "Reset Password"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
