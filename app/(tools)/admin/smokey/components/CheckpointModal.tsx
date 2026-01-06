"use client";

import React, { useState } from "react";

type CheckpointModalProps = {
  planId: string;
  taskNumber: number;
  taskCode: string;
  successConditions: string[];
  validateWith: "audit" | "manual";
  onClose: () => void;
  onEvaluate: (result: 'pass' | 'partial' | 'fail', reasoning?: string) => Promise<void>;
};

export default function CheckpointModal({
  planId,
  taskNumber,
  taskCode,
  successConditions,
  validateWith,
  onClose,
  onEvaluate,
}: CheckpointModalProps) {
  const [evaluating, setEvaluating] = useState(false);
  const [manualResult, setManualResult] = useState<'pass' | 'partial' | 'fail' | null>(null);
  const [reasoning, setReasoning] = useState("");

  const handleRunAudit = async () => {
    setEvaluating(true);
    try {
      const response = await fetch(`/api/admin/smokey/plans/${planId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkpoint-with-audit",
          taskNumber,
        }),
      });

      if (response.ok) {
        const { evaluation } = await response.json();
        await onEvaluate(evaluation.result, evaluation.data.reasoning);
        onClose();
      }
    } catch (error) {
      console.error("Error evaluating checkpoint:", error);
    } finally {
      setEvaluating(false);
    }
  };

  const handleManualConfirm = async () => {
    if (!manualResult) return;

    setEvaluating(true);
    try {
      await onEvaluate(manualResult, reasoning);
      onClose();
    } catch (error) {
      console.error("Error evaluating checkpoint:", error);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-obsidian rounded-lg border border-steel-gray p-6 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Checkpoint Evaluation</h2>
          <button
            onClick={onClose}
            className="text-cool-ash hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-cool-ash mb-4">
            Task {taskCode} - Evaluate checkpoint
          </p>

          {/* Success Conditions Checklist */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Success Conditions:</h3>
            <ul className="space-y-2">
              {successConditions.map((condition, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled
                  />
                  <span className="text-sm text-cool-ash">{condition}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Input Method */}
          {validateWith === "audit" && (
            <div className="mb-6">
              <button
                onClick={handleRunAudit}
                disabled={evaluating}
                className="w-full px-6 py-3 bg-[#2F80FF] hover:bg-[#2566cc] disabled:opacity-50 rounded text-white font-semibold transition-colors"
              >
                {evaluating ? "Running Audit..." : "Run Audit"}
              </button>
            </div>
          )}

          {validateWith === "manual" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Manual Result:
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="result"
                      value="pass"
                      checked={manualResult === 'pass'}
                      onChange={() => setManualResult('pass')}
                    />
                    <span className="text-green-600">Pass</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="result"
                      value="partial"
                      checked={manualResult === 'partial'}
                      onChange={() => setManualResult('partial')}
                    />
                    <span className="text-yellow-600">Partial</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="result"
                      value="fail"
                      checked={manualResult === 'fail'}
                      onChange={() => setManualResult('fail')}
                    />
                    <span className="text-red-600">Fail</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Reasoning:
                </label>
                <textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  className="w-full px-4 py-2 bg-void-black border border-steel-gray rounded text-white"
                  rows={3}
                  placeholder="Enter reasoning for this evaluation..."
                />
              </div>

              <button
                onClick={handleManualConfirm}
                disabled={!manualResult || evaluating}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-white font-semibold transition-colors"
              >
                {evaluating ? "Evaluating..." : "Confirm Evaluation"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
