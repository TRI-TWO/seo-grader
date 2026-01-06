"use client";

import React from "react";

type Plan = {
  id: string;
  planType: string;
  objective: string;
  status: string;
  scheduledMonth: number | null;
  dependsOnPlanId: string | null;
  blocking: boolean;
  reassessAfter: string | null;
  decision?: {
    id: string;
    decisionSummary: string | null;
    decisionConfidence: number | null;
    reasoning: string | null;
  } | null;
};

type PlanCardProps = {
  plan: Plan;
  isExpanded: boolean;
  onToggle: () => void;
  onPause: () => void;
  onAbort: () => void;
};

export default function PlanCard({
  plan,
  isExpanded,
  onToggle,
  onPause,
  onAbort,
}: PlanCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-600';
      case 'queued':
        return 'bg-yellow-600';
      case 'paused':
        return 'bg-gray-600';
      case 'completed':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
    }
  };

  const formatPlanType = (planType: string) => {
    return planType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatConfidence = (confidence: number | null) => {
    if (confidence === null) return 'N/A';
    return `${Math.round(confidence * 100)}%`;
  };

  return (
    <div
      className="bg-void-black rounded border border-steel-gray p-3 cursor-pointer hover:border-[#2F80FF] transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">
            {formatPlanType(plan.planType)}
          </h4>
          <p className="text-xs text-cool-ash line-clamp-2 mb-2">
            {plan.objective}
          </p>
          
          {/* Decision Summary */}
          {plan.decision?.decisionSummary && (
            <p className="text-xs text-cool-ash mb-1">
              <span className="font-semibold">Decision:</span> {plan.decision.decisionSummary}
            </p>
          )}
          
          {/* Decision Confidence */}
          {plan.decision?.decisionConfidence !== null && plan.decision?.decisionConfidence !== undefined && (
            <p className="text-xs text-cool-ash mb-2">
              <span className="font-semibold">Confidence:</span> {formatConfidence(plan.decision.decisionConfidence)}
            </p>
          )}
        </div>
        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(plan.status)}`}>
          {plan.status}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-2">
        {plan.blocking && (
          <span className="px-2 py-1 bg-red-600 rounded text-xs">Blocking</span>
        )}
        {plan.dependsOnPlanId && (
          <span className="px-2 py-1 bg-yellow-600 rounded text-xs">
            Depends on P-{plan.dependsOnPlanId.slice(0, 6)}
          </span>
        )}
        {plan.scheduledMonth && (
          <span className="px-2 py-1 bg-blue-600 rounded text-xs">
            Month {plan.scheduledMonth}
          </span>
        )}
      </div>
      
      {plan.reassessAfter && (
        <p className="text-xs text-cool-ash mb-2">
          Next reassess: {new Date(plan.reassessAfter).toLocaleDateString()}
        </p>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex-1 px-3 py-1.5 bg-[#2F80FF] hover:bg-[#2566cc] rounded text-xs transition-colors"
        >
          {isExpanded ? 'Hide Tasks' : 'Open Tasks'}
        </button>
        {plan.status === 'active' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPause();
            }}
            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-xs transition-colors"
          >
            Pause
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAbort();
          }}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
        >
          Abort
        </button>
      </div>
    </div>
  );
}

