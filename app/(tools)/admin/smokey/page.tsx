"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { prisma } from "@/lib/prisma";
import { getClientTimeline, regenerateTimeline, reschedulePhase, skipPhase } from "@/lib/smokey/scheduler";
import { validateSmokeyPreconditions } from "@/lib/smokey/guardrails";

export default function AdminSmokeyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadTimeline(selectedClientId);
    }
  }, [selectedClientId]);

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push("/login");
        return;
      }

      if (user.email !== 'mgr@tri-two.com') {
        router.push("/");
        return;
      }

      setIsAdmin(true);
      await loadClients();
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await fetch('/api/admin/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  const loadTimeline = async (clientId: string) => {
    try {
      const response = await fetch(`/api/admin/smokey/timeline?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setTimeline(data.timeline || []);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to load timeline");
      }
    } catch (error: any) {
      setError(error.message || "Failed to load timeline");
    }
  };

  const handleRegenerateTimeline = async () => {
    if (!selectedClientId) return;

    try {
      const response = await fetch('/api/admin/smokey/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      });

      if (response.ok) {
        await loadTimeline(selectedClientId);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to regenerate timeline");
      }
    } catch (error: any) {
      setError(error.message || "Failed to regenerate timeline");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom, #0b0f1a, #05070d)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: 'linear-gradient(to bottom, #0b0f1a, #05070d)' }}>
      <div className="relative z-10 p-8">
        <h1 className="text-4xl font-bold mb-8">Smokey - Timeline Planner</h1>
        
        {error && (
          <div className="bg-red-600 border border-red-700 rounded-lg px-4 py-3 mb-6">
            <div className="text-white text-sm">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Client Selection */}
          <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
            <h2 className="text-2xl font-semibold mb-4">Select Client</h2>
            <select
              value={selectedClientId || ''}
              onChange={(e) => setSelectedClientId(e.target.value || null)}
              className="w-full px-4 py-3 bg-void-black border border-steel-gray rounded-lg text-white mb-4"
            >
              <option value="">-- Select a client --</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName || client.email} ({client.status})
                </option>
              ))}
            </select>

            {selectedClientId && (
              <button
                onClick={handleRegenerateTimeline}
                className="w-full px-6 py-3 bg-[#2F80FF] hover:bg-[#2566cc] text-white font-semibold rounded-lg transition-colors"
              >
                Regenerate Timeline
              </button>
            )}
          </div>

          {/* Timeline Display */}
          <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
            <h2 className="text-2xl font-semibold mb-4">Timeline</h2>
            {selectedClientId ? (
              <div className="space-y-4">
                {timeline.length > 0 ? (
                  timeline.map((phase) => (
                    <div
                      key={phase.id}
                      className="bg-void-black rounded-lg border border-steel-gray p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{phase.phaseName}</h3>
                        <span className="text-xs text-cool-ash">{phase.status}</span>
                      </div>
                      <p className="text-sm text-cool-ash mb-2">
                        {new Date(phase.scheduledDate).toLocaleDateString()}
                      </p>
                      {phase.description && (
                        <p className="text-xs text-cool-ash">{phase.description}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-cool-ash">No timeline entries found. Generate a timeline first.</p>
                )}
              </div>
            ) : (
              <p className="text-cool-ash">Select a client to view timeline</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

