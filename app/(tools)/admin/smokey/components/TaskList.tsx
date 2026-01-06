"use client";

import React, { useState } from "react";
import CheckpointModal from "./CheckpointModal";

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

type TaskListProps = {
  planId: string;
  tasks: Task[];
  onRefresh: () => void;
};

export default function TaskList({ planId, tasks, onRefresh }: TaskListProps) {
  const [executingTask, setExecutingTask] = useState<string | null>(null);
  const [checkpointTask, setCheckpointTask] = useState<Task | null>(null);

  const handleLaunchTool = async (task: Task) => {
    setExecutingTask(task.id);
    try {
      // Create tool session
      const response = await fetch('/api/admin/smokey/tool-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          taskId: task.id,
          tool: task.tool,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const session = data.session;
        
        // Launch tool session
        const launchResponse = await fetch('/api/admin/smokey/tool-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'launch',
            sessionId: session.id,
          }),
        });

        if (launchResponse.ok) {
          const launchData = await launchResponse.json();
          if (launchData.routing?.path) {
            window.open(launchData.routing.path, '_blank');
          }
        }
      }
    } catch (error) {
      console.error('Error launching tool:', error);
    } finally {
      setExecutingTask(null);
    }
  };

  const handleExecuteTask = async (task: Task) => {
    try {
      const response = await fetch(`/api/admin/smokey/plans/${planId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute-task',
          taskNumber: task.taskNumber,
        }),
      });

      if (response.ok) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error executing task:', error);
    }
  };

  const handleMarkDone = async (task: Task) => {
    try {
      // Update task status to done
      const response = await fetch(`/api/admin/smokey/plans/${planId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-task-done',
          taskNumber: task.taskNumber,
        }),
      });

      if (response.ok) {
        await onRefresh();
        
        // If task has checkpoint, show checkpoint modal
        if (task.hasCheckpoint) {
          setCheckpointTask(task);
        }
      }
    } catch (error) {
      console.error('Error marking task done:', error);
    }
  };

  const handleCheckpointEvaluate = async (result: 'pass' | 'partial' | 'fail', reasoning?: string) => {
    if (!checkpointTask) return;

    try {
      const response = await fetch(`/api/admin/smokey/plans/${planId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual-checkpoint',
          taskNumber: checkpointTask.taskNumber,
          result,
          reasoning: reasoning || '',
        }),
      });

      if (response.ok) {
        await onRefresh();
        setCheckpointTask(null);
      }
    } catch (error) {
      console.error('Error evaluating checkpoint:', error);
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'done':
      case 'completed':
        return 'bg-green-600';
      case 'in_progress':
        return 'bg-blue-600';
      case 'ready':
        return 'bg-yellow-600';
      case 'locked':
        return 'bg-gray-600';
      case 'blocked':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  // Sort tasks by taskNumber
  const sortedTasks = [...tasks].sort((a, b) => a.taskNumber - b.taskNumber);

  return (
    <div className="space-y-2">
      {sortedTasks.map((task) => (
        <div
          key={task.id}
          className="p-3 bg-void-black rounded border border-steel-gray"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-cool-ash">
                  {task.taskCode || `${task.taskNumber}.${task.taskNumber}`}
                </span>
                <span className={`px-2 py-1 rounded text-xs ${getTaskStatusColor(task.status)}`}>
                  {task.status}
                </span>
                <span className="px-2 py-1 bg-steel-gray rounded text-xs">
                  {task.tool}
                </span>
              </div>
              <h4 className="font-semibold text-sm">{task.title}</h4>
            </div>
          </div>

          <div className="flex gap-2">
            {task.status === 'ready' && (
              <>
                <button
                  onClick={() => handleLaunchTool(task)}
                  disabled={executingTask === task.id}
                  className="flex-1 px-3 py-1.5 bg-[#2F80FF] hover:bg-[#2566cc] disabled:opacity-50 rounded text-xs transition-colors"
                >
                  {executingTask === task.id ? 'Launching...' : 'Launch Tool'}
                </button>
                <button
                  onClick={() => handleExecuteTask(task)}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
                >
                  Execute
                </button>
              </>
            )}
            {task.status === 'in_progress' && (
              <button
                onClick={() => handleMarkDone(task)}
                className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
              >
                Mark Done
              </button>
            )}
            {task.status !== 'locked' && task.status !== 'blocked' && (
              <button
                onClick={() => {
                  const reason = prompt('Reason for skipping:');
                  if (reason) {
                    // Skip task with reason
                  }
                }}
                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-xs transition-colors"
              >
                Skip
              </button>
            )}
          </div>

          {task.checkpoint && (
            <div className="mt-2 p-2 bg-steel-gray rounded text-xs">
              <div className="flex items-center gap-2">
                <span>Checkpoint:</span>
                <span className={`px-2 py-1 rounded ${
                  task.checkpoint.result === 'pass' ? 'bg-green-600' :
                  task.checkpoint.result === 'partial' ? 'bg-yellow-600' :
                  task.checkpoint.result === 'fail' ? 'bg-red-600' :
                  'bg-gray-600'
                }`}>
                  {task.checkpoint.result || 'Pending'}
                </span>
              </div>
            </div>
          )}

          {/* Show checkpoint button for blocking tasks that are done */}
          {task.status === 'done' && 
           task.hasCheckpoint && 
           !task.checkpoint && (
            <button
              onClick={() => setCheckpointTask(task)}
              className="mt-2 w-full px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
            >
              Evaluate Checkpoint
            </button>
          )}
        </div>
      ))}

      {/* Checkpoint Modal */}
      {checkpointTask && (
        <CheckpointModal
          planId={planId}
          taskNumber={checkpointTask.taskNumber}
          taskCode={checkpointTask.taskCode || `${checkpointTask.taskNumber}.${checkpointTask.taskNumber}`}
          successConditions={checkpointTask.checkpoint?.successConditions || []}
          validateWith={(checkpointTask.checkpoint?.validateWith as "audit" | "manual") || "audit"}
          onClose={() => setCheckpointTask(null)}
          onEvaluate={handleCheckpointEvaluate}
        />
      )}
    </div>
  );
}

