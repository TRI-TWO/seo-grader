"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlanTier } from "@prisma/client";
import PlanCard from "./components/PlanCard";
import TaskList from "./components/TaskList";

type Plan = {
  id: string;
  planType: string;
  objective: string;
  status: string;
  scheduledMonth: number | null;
  dependsOnPlanId: string | null;
  blocking: boolean;
  reassessAfter: string | null;
  startedAt: string;
  createdAt: string;
  updatedAt: string;
  decision?: {
    id: string;
    decisionSummary: string | null;
    decisionConfidence: number | null;
    reasoning: string | null;
  } | null;
  tasks: Task[];
  dependsOnPlan?: Plan | null;
};

type Task = {
  id: string;
  taskNumber: number;
  taskCode: string | null;
  title: string;
  tool: string;
  status: string;
  hasCheckpoint: boolean;
  checkpoint?: {
    id: string;
    result: string | null;
    evaluatedAt: string | null;
    evaluationData: any;
    validateWith: string | null;
    successConditions: any;
  } | null;
};

type ClientData = {
  id: string;
  companyName: string | null;
  canonicalUrl: string;
  planTier: PlanTier;
  contractDuration: number;
  activePlansCount: number;
  queuedPlansCount: number;
  lastActivityTimestamp: string | null;
  plans: Plan[];
};

export default function AdminSmokeyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsData, setClientsData] = useState<Record<string, ClientData>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (clients.length > 0) {
      loadAllClientsData();
    }
  }, [clients]);

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

  const loadAllClientsData = async () => {
    const data: Record<string, ClientData> = {};
    
    for (const client of clients) {
      try {
        // Get plans for this client
        const plansResponse = await fetch(
          `/api/admin/smokey/plans?clientId=${client.id}&action=all`
        );
        
        if (plansResponse.ok) {
          const plansData = await plansResponse.json();
          const plans = plansData.plans || [];
          
          // Get active and queued counts
          const activePlans = plans.filter((p: Plan) => p.status === 'active');
          const queuedPlans = plans.filter((p: Plan) => p.status === 'queued');
          
          // Get last activity timestamp (use most recent plan's updatedAt)
          const lastActivity = plans.length > 0 
            ? plans.sort((a: Plan, b: Plan) => 
                new Date(b.updatedAt || b.createdAt).getTime() - 
                new Date(a.updatedAt || a.createdAt).getTime()
              )[0].updatedAt || plans[0].createdAt
            : null;
          
          data[client.id] = {
            id: client.id,
            companyName: client.companyName,
            canonicalUrl: client.canonicalUrl,
            planTier: client.planTier,
            contractDuration: client.contractLengthMonths || 12,
            activePlansCount: activePlans.length,
            queuedPlansCount: queuedPlans.length,
            lastActivityTimestamp: lastActivity,
            plans: plans,
          };
        }
      } catch (error) {
        console.error(`Error loading data for client ${client.id}:`, error);
      }
    }
    
    setClientsData(data);
  };

  const togglePlanExpansion = (planId: string) => {
    const newExpanded = new Set(expandedPlans);
    if (newExpanded.has(planId)) {
      newExpanded.delete(planId);
    } else {
      newExpanded.add(planId);
    }
    setExpandedPlans(newExpanded);
  };

  const getTierLabel = (tier: PlanTier) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString();
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Smokey - Decision Engine</h1>
        </div>
        
        {error && (
          <div className="bg-red-600 border border-red-700 rounded-lg px-4 py-3 mb-6">
            <div className="text-white text-sm">{error}</div>
          </div>
        )}

        {/* One Column Per Client Layout */}
        <div className="overflow-x-auto">
          <div className="flex gap-6 min-w-max pb-6">
            {clients.map((client) => {
              const clientData = clientsData[client.id];
              if (!clientData) {
                return (
                  <div key={client.id} className="flex-shrink-0 w-96 bg-obsidian rounded-lg border border-steel-gray p-4">
                    <div className="text-cool-ash">Loading...</div>
                  </div>
                );
              }

              // Sort plans by scheduledMonth and creation time
              const sortedPlans = [...clientData.plans].sort((a, b) => {
                if (a.scheduledMonth !== b.scheduledMonth) {
                  return (a.scheduledMonth || 999) - (b.scheduledMonth || 999);
                }
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              });

              return (
                <div
                  key={client.id}
                  className="flex-shrink-0 w-96 bg-obsidian rounded-lg border border-steel-gray p-4"
                >
                  {/* Client Header */}
                  <div className="mb-4 pb-4 border-b border-steel-gray">
                    <h2 className="text-xl font-semibold mb-2">
                      {clientData.companyName || 'Client'}
                    </h2>
                    <p className="text-xs text-cool-ash mb-2">{clientData.canonicalUrl}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-blue-600 rounded">
                        {getTierLabel(clientData.planTier)}
                      </span>
                      <span className="px-2 py-1 bg-gray-600 rounded">
                        {clientData.contractDuration} months
                      </span>
                      <span className="px-2 py-1 bg-green-600 rounded">
                        {clientData.activePlansCount} active
                      </span>
                      {clientData.queuedPlansCount > 0 && (
                        <span className="px-2 py-1 bg-yellow-600 rounded">
                          {clientData.queuedPlansCount} queued
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-cool-ash mt-2">
                      Last activity: {formatTimestamp(clientData.lastActivityTimestamp)}
                    </p>
                  </div>

                  {/* Plans Stack Vertically */}
                  <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {sortedPlans.map((plan) => (
                      <div key={plan.id}>
                        <PlanCard
                          plan={plan}
                          isExpanded={expandedPlans.has(plan.id)}
                          onToggle={() => togglePlanExpansion(plan.id)}
                          onPause={async () => {
                            try {
                              await fetch(`/api/admin/smokey/plans/${plan.id}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'pause' }),
                              });
                              await loadAllClientsData();
                            } catch (error) {
                              console.error('Error pausing plan:', error);
                            }
                          }}
                          onAbort={async () => {
                            if (confirm('Are you sure you want to abort this plan?')) {
                              try {
                                await fetch(`/api/admin/smokey/plans/${plan.id}`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'abort' }),
                                });
                                await loadAllClientsData();
                              } catch (error) {
                                console.error('Error aborting plan:', error);
                              }
                            }
                          }}
                        />
                        {expandedPlans.has(plan.id) && (
                          <div className="mt-2 ml-4">
                            <TaskList
                              planId={plan.id}
                              tasks={plan.tasks}
                              onRefresh={loadAllClientsData}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Add Plan Button */}
                    <button
                      onClick={() => {
                        // Show plan creation modal
                        const planType = prompt('Enter plan type:');
                        if (planType) {
                          // Create plan via decision
                          // This should go through Smokey's decision engine
                        }
                      }}
                      className="w-full px-4 py-3 border-2 border-dashed border-steel-gray rounded text-cool-ash hover:border-[#2F80FF] hover:text-[#2F80FF] transition-colors text-sm"
                    >
                      + Add Plan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
