"use client";

import React, { useState } from "react";

interface StripeCheckoutProps {
  auditId?: string;
  canonicalUrl: string;
  onSuccess?: () => void;
}

export default function StripeCheckout({ auditId, canonicalUrl, onSuccess }: StripeCheckoutProps) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    customerName: "",
    companyName: "",
    canonicalUrl: canonicalUrl || "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          auditId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xl px-8 py-4 rounded-lg transition shadow-lg"
      >
        $5.99 Upgrade Results
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-600 border border-red-700 rounded-lg px-4 py-3">
          <div className="text-white text-sm">{error}</div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Name (Required) *
        </label>
        <input
          type="text"
          value={formData.customerName}
          onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
          required
          disabled={loading}
          className="w-full px-4 py-3 bg-void-black border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
          placeholder="Your full name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Company Name (Required) *
        </label>
        <input
          type="text"
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          required
          disabled={loading}
          className="w-full px-4 py-3 bg-void-black border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
          placeholder="Your company name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Website URL (Required) *
        </label>
        <input
          type="url"
          value={formData.canonicalUrl}
          onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
          required
          disabled={loading}
          className="w-full px-4 py-3 bg-void-black border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
          placeholder="https://example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Email (Required) *
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          disabled={loading}
          className="w-full px-4 py-3 bg-void-black border border-steel-gray rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
          placeholder="your@email.com"
        />
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-4 rounded-lg transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Continue to Payment ($5.99)"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowForm(false);
            setError(null);
          }}
          disabled={loading}
          className="px-6 py-4 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

