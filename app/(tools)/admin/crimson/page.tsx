"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
// BrandLogo and HamburgerMenu are now in the layout

type Template = {
  id: string;
  title: string;
  description: string;
  icon: string;
  seoIntent: "informational" | "transactional" | "comparison";
  channels: string[];
};

const TEMPLATES: Template[] = [
  {
    id: "seo_blog_post",
    title: "SEO Blog Post",
    description: "Create or refine long-form content optimized for search.",
    icon: "📝",
    seoIntent: "informational",
    channels: ["Blog", "Website"],
  },
  {
    id: "listicle",
    title: "Listicle",
    description: "Turn a topic into scannable, ranked sections with strong SEO structure.",
    icon: "📋",
    seoIntent: "informational",
    channels: ["Blog", "Website"],
  },
  {
    id: "local_service_page",
    title: "Local Service Page",
    description: "Improve a local landing page for relevance, trust, and conversion.",
    icon: "📍",
    seoIntent: "transactional",
    channels: ["Website"],
  },
  {
    id: "product_landing_page",
    title: "Product Landing Page",
    description: "Optimize product messaging, benefits, and conversion CTAs.",
    icon: "🛍️",
    seoIntent: "transactional",
    channels: ["Website"],
  },
  {
    id: "email_campaign",
    title: "Email Campaign",
    description: "Generate or improve email copy aligned with your objective.",
    icon: "✉️",
    seoIntent: "transactional",
    channels: ["Email"],
  },
  {
    id: "seo_audit_summary",
    title: "SEO Audit Summary",
    description: "Turn findings into client-friendly summaries and next steps.",
    icon: "📊",
    seoIntent: "comparison",
    channels: ["Website", "Client Delivery"],
  },
  {
    id: "social_media_thread",
    title: "Social Media Thread",
    description: "Convert ideas into a structured thread optimized for engagement.",
    icon: "💬",
    seoIntent: "informational",
    channels: ["Social"],
  },
  {
    id: "how_to_guide",
    title: "How-To Guide",
    description: "Create step-by-step guidance content that ranks and converts.",
    icon: "📖",
    seoIntent: "informational",
    channels: ["Blog", "Website"],
  },
];

function AdminCrimsonPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    
    // If URL and goal params exist (workflow handoff), redirect to create page
    const urlParam = searchParams.get('url');
    const goalParam = searchParams.get('goal');
    if (urlParam && goalParam) {
      router.replace(`/admin/crimson/create?url=${encodeURIComponent(urlParam)}&goal=${encodeURIComponent(goalParam)}`);
    }
  }, [searchParams, router]);

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push("/login");
        return;
      }

      // Check if user is admin by email
      if (user.email !== 'mgr@tri-two.com') {
        router.push("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/login");
    }
  };

  const handleTemplateSelect = (template: Template) => {
    router.push(`/admin/crimson/create?contentType=${template.id}&defaultSeoIntent=${template.seoIntent}`);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-void-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-200px)] px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/admin" className="text-laser-blue hover:text-light-blue-tint">
            ← Back to Admin Dashboard
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2">Crimson</h1>
        <p className="text-gray-400 text-sm mb-2">Improve what the page says based on your goal.</p>
        <p className="text-gray-400 text-sm mb-8">Pick a template to start, then confirm the URL and goal on the next step.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              className="text-left p-6 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition hover:border-zinc-600"
              style={{ backgroundColor: 'var(--bg-secondary, #181b21)' }}
            >
              <div className="text-3xl mb-3">{template.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{template.title}</h3>
              <p className="text-sm text-gray-400 mb-3">{template.description}</p>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  template.seoIntent === 'informational' ? 'bg-blue-500/20 text-blue-300' :
                  template.seoIntent === 'transactional' ? 'bg-green-500/20 text-green-300' :
                  'bg-purple-500/20 text-purple-300'
                }`}>
                  {template.seoIntent}
                </span>
                {template.channels.map((channel, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 rounded bg-zinc-800 text-gray-400">
                    {channel}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function AdminCrimsonPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[calc(100vh-200px)] px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
            <p className="text-cool-ash">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <AdminCrimsonPageContent />
    </Suspense>
  );
}
