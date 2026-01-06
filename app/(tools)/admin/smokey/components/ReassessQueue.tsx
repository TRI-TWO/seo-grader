"use client";

import React, { useState, useEffect } from "react";

type Plan = {
  id: string;
  planType: string;
  status: string;
  reassessAfter: string | null;
  objective: string;
  tasks: Array<{
    id: string;
    taskNumber: number;
    checkpoint: {
      id: string;
      result: string | null;
    } | null;
  }>;
  client: {
    id: string;
    companyName: string | null;
    canonicalUrl: string;
  };
};

export default function ReassessQueue() {
  const [plansByDate, setPlansByDate] = useState<Record<string, Plan[]>>({});
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState<string | null>(null);

  useEffect(() => {
    loadReassessQueue();
  }, []);

  const loadReassessQueue = async () => {
    try {
      const response = await fetch('/api/admin/smokey/reassess');
      if (response.ok) {
        const data = await response.json();
        setPlansByDate(data.plans || {});
      }
    } catch (error) {
      console.error('Error loading reassess queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCheckpoint = async (plan: Plan) => {
    setEvaluating(plan.id);
    try {
      // Get the last task with checkpoint
      const lastTask = plan.tasks
        .filter((t) => t.checkpoint)
        .sort((a, b) => b.taskNumber - a.taskNumber)[0];

      if (!lastTask) {
        alert('No checkpoint found for this plan');
        return;
      }

      const response = await fetch(`/api/admin/smokey/plans/${plan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkpoint-with-audit',
          taskNumber: lastTask.taskNumber,
        }),
      });

      if (response.ok) {
        await loadReassessQueue();
      }
    } catch (error) {
      console.error('Error running checkpoint:', error);
    } finally {
      setEvaluating(null);
    }
  };

  const getPlanTypeLabel = (planType: string) => {
    return planType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-cool-ash">Loading reassess queue...</div>
      </div>
    );
  }

  const dates = Object.keys(plansByDate).sort();

  if (dates.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Reassess Queue</h2>
        <div className="text-cool-ash">No plans due for reassessment</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Reassess Queue</h2>
      <div className="space-y-6">
        {dates.map((date) => (
          <div key={date} className="bg-obsidian rounded-lg border border-steel-gray p-4">
            <h3 className="font-semibold mb-4">{formatDate(date)}</h3>
            <div className="space-y-3">
              {plansByDate[date].map((plan) => (
                <div
                  key={plan.id}
                  className="bg-void-black rounded border border-steel-gray p-3"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">
                        {plan.client.companyName || 'Client'}
                      </h4>
                      <p className="text-xs text-cool-ash mb-1">
                        {plan.client.canonicalUrl}
                      </p>
                      <p className="text-sm font-semibold mb-1">
                        {getPlanTypeLabel(plan.planType)}
                      </p>
                      <p className="text-xs text-cool-ash line-clamp-1">
                        {plan.objective}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRunCheckpoint(plan)}
                      disabled={evaluating === plan.id}
                      className="px-4 py-2 bg-[#2F80FF] hover:bg-[#2566cc] disabled:opacity-50 rounded text-sm transition-colors"
                    >
                      {evaluating === plan.id ? 'Running...' : 'Run Checkpoint'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
