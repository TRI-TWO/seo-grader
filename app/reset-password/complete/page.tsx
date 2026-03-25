"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/app/components/BrandLogo";
import HamburgerMenu from "@/app/components/HamburgerMenu";

const PKCE_STORAGE_PREFIX = "sb_recovery_pkce_";

/** Landing page for Supabase recovery emails (`redirectTo`). Handles ?code= (PKCE), hash tokens, and Strict Mode double-mount. */
export default function ResetPasswordCompletePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  useEffect(() => {
    const validateSession = async () => {
      try {
        const supabase = createClient();
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // Hash-based redirect (some Supabase / template configurations)
        const hash = window.location.hash?.replace(/^#/, "") || "";
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");
          const hashError = hashParams.get("error_description") || hashParams.get("error");
          if (hashError) {
            setError(decodeURIComponent(hashError.replace(/\+/g, " ")));
            setValidating(false);
            return;
          }
          if (access_token && refresh_token) {
            const implicitKey = `${PKCE_STORAGE_PREFIX}implicit`;
            if (!sessionStorage.getItem(implicitKey)) {
              const { error: setErr } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              if (setErr) {
                setError(
                  setErr.message ||
                    "Invalid or expired reset link. Request a new one."
                );
                setValidating(false);
                return;
              }
              sessionStorage.setItem(implicitKey, "1");
            }
            window.history.replaceState(null, "", url.pathname + url.search);
          }
        }

        // PKCE: exchange ?code= once (React Strict Mode mounts twice; reusing code causes verify 403)
        if (code) {
          const storageKey = `${PKCE_STORAGE_PREFIX}${code}`;
          const already = sessionStorage.getItem(storageKey);
          if (!already) {
            const { error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              setError(
                exchangeError.message ||
                  "This reset link was already used or expired. Request a new link and open it once."
              );
              setValidating(false);
              return;
            }
            sessionStorage.setItem(storageKey, "1");
          }
          window.history.replaceState(null, "", url.pathname);
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          setError("Invalid or expired reset token");
          setValidating(false);
          return;
        }

        if (session) {
          setTokenValid(true);
        } else {
          setError(
            "Invalid or expired reset link. Request a new link and open it in this browser only once."
          );
        }
      } catch {
        setError("An error occurred while validating the reset link");
      } finally {
        setValidating(false);
      }
    };

    validateSession();
  }, []);

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
        setError(
          updateError.message ||
            "Failed to update password. The reset link may have expired."
        );
        setLoading(false);
      } else {
        setSuccess(true);
        setLoading(false);
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-bold mb-4">Verifying reset link…</div>
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
                Link invalid or expired
              </h1>
              {error ? (
                <div className="bg-red-600 border border-red-700 rounded-lg px-4 py-3 mb-4">
                  <div className="text-white text-sm">{error}</div>
                </div>
              ) : null}
              <p className="text-gray-400 text-sm mb-4 text-center">
                Open the latest email link once. If you refreshed this page, request
                a new reset from the login page.
              </p>
              <Link
                href="/reset-password"
                className="block text-center text-sm"
                style={{ color: "#16b8a6" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#14a895")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#16b8a6")}
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
        <header className="bg-void-black flex items-center justify-between px-6 py-4 md:px-12 md:py-6">
          <div className="flex-shrink-0">
            <BrandLogo />
          </div>
          <div className="flex-shrink-0">
            <HamburgerMenu />
          </div>
        </header>

        <main className="min-h-[calc(100vh-200px)] px-6 py-12 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-8">
              <h1 className="text-3xl font-bold mb-6 text-center">
                Set new password
              </h1>

              {success ? (
                <div className="space-y-4">
                  <div className="bg-green-600 border border-green-700 rounded-lg px-4 py-3">
                    <div className="text-white text-sm">
                      Password updated. Redirecting to login…
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {error ? (
                    <div className="bg-red-600 border border-red-700 rounded-lg px-4 py-3 mb-4">
                      <div className="text-white text-sm">{error}</div>
                    </div>
                  ) : null}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-gray-300 mb-2"
                      >
                        New password
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                        style={
                          { "--tw-ring-color": "#16b8a6" } as React.CSSProperties
                        }
                        placeholder="••••••••"
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        At least 8 characters
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-gray-300 mb-2"
                      >
                        Confirm password
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                        style={
                          { "--tw-ring-color": "#16b8a6" } as React.CSSProperties
                        }
                        placeholder="••••••••"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "#16b8a6" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#14a895")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "#16b8a6")
                      }
                    >
                      {loading ? "Saving…" : "Save password"}
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
