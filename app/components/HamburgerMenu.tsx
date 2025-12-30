"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

export default function HamburgerMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setShowMenu(false);
    router.push("/");
    router.refresh();
  };

  const handleLinkClick = () => {
    setShowMenu(false);
  };

  // Determine if we're on home page for pricing navigation
  const isHomePage = pathname === "/";

  return (
    <div className="relative">
      {/* Hamburger Icon Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 rounded-lg transition hover:bg-zinc-800"
        style={{ color: '#16b8a6' }}
        aria-label="Menu"
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {showMenu ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50">
            <div className="py-1">
              {/* Home */}
              <Link
                href="/"
                onClick={handleLinkClick}
                className={`block px-4 py-2 text-base font-medium transition ${
                  pathname === "/" && !isHomePage
                    ? "text-white bg-zinc-700"
                    : "text-gray-300 hover:text-white hover:bg-zinc-700"
                }`}
              >
                Home
              </Link>

              {/* Pricing */}
              {isHomePage ? (
                <button
                  onClick={() => {
                    handleLinkClick();
                    // Scroll to pricing section or handle pricing tab
                    const event = new CustomEvent('navigateToPricing');
                    window.dispatchEvent(event);
                  }}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-gray-300 hover:text-white hover:bg-zinc-700 transition"
                >
                  Pricing
                </button>
              ) : (
                <Link
                  href="/#pricing"
                  onClick={handleLinkClick}
                  className="block px-4 py-2 text-base font-medium text-gray-300 hover:text-white hover:bg-zinc-700 transition"
                >
                  Pricing
                </Link>
              )}

              {/* About */}
              <Link
                href="/about"
                onClick={handleLinkClick}
                className={`block px-4 py-2 text-base font-medium transition ${
                  pathname === "/about"
                    ? "text-white bg-zinc-700"
                    : "text-gray-300 hover:text-white hover:bg-zinc-700"
                }`}
              >
                About
              </Link>

              {/* Login / Log Out */}
              {loading ? (
                <div className="px-4 py-2 text-base text-gray-400">Loading...</div>
              ) : user ? (
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-gray-300 hover:text-white hover:bg-zinc-700 transition"
                >
                  Log Out
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={handleLinkClick}
                  className={`block px-4 py-2 text-base font-medium transition ${
                    pathname === "/login"
                      ? "text-white bg-zinc-700"
                      : "text-gray-300 hover:text-white hover:bg-zinc-700"
                  }`}
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}



