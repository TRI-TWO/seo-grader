import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  pausePlan,
  resumePlan,
  branchPlan,
} from '@/lib/smokey/planEngine';
import { executeTask } from '@/lib/smokey/taskExecutor';
import { evaluateCheckpoint, evaluateCheckpointWithAudit, manualCheckpointEvaluation } from '@/lib/smokey/checkpoints';

export async function GET(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { planId } = params;
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    if (action === 'next-task') {
      const { getNextTask } = await import('@/lib/smokey/planEngine');
      const task = await getNextTask(planId);
      return NextResponse.json({ task });
    } else {
      // Get plan details
      const { prisma } = await import('@/lib/prisma');
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
          tasks: {
            orderBy: { taskNumber: 'asc' },
            // Note: checkpoint and toolSessions fetched explicitly when needed
          },
          dependsOnPlan: true,
          dependentPlans: true,
        },
      });
      return NextResponse.json({ plan });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { planId } = params;
  const body = await req.json();
  const { action, taskNumber, result, reasoning, newPlanType, reason } = body;

  try {
    switch (action) {
      case 'execute-task':
        if (!taskNumber) {
          return NextResponse.json(
            { error: 'taskNumber is required for execute-task' },
            { status: 400 }
          );
        }
        const executionResults = await executeTask(planId, taskNumber);
        return NextResponse.json({ executionResults });

      case 'mark-task-done':
        if (!taskNumber) {
          return NextResponse.json(
            { error: 'taskNumber is required for mark-task-done' },
            { status: 400 }
          );
        }
        const { prisma } = await import('@/lib/prisma');
        const { logEvent } = await import('@/lib/smokey/events');
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) {
          return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }
        const task = await prisma.task.findFirst({
          where: { planId, taskNumber },
        });
        if (!task) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        await prisma.task.update({
          where: { id: task.id },
          data: { status: 'done' },
        });
        await logEvent(plan.clientId, 'task_completed', 'task', task.id, {
          planId,
          taskNumber,
          status: 'done',
        });
        return NextResponse.json({ success: true });

      case 'abort':
        const aborted = await pausePlan(planId); // Pause is effectively abort for now
        return NextResponse.json({ plan: aborted });

      case 'checkpoint':
        if (!taskNumber) {
          return NextResponse.json(
            { error: 'taskNumber is required for checkpoint' },
            { status: 400 }
          );
        }
        const evaluation = await evaluateCheckpoint(planId, taskNumber);
        return NextResponse.json({ evaluation });

      case 'checkpoint-with-audit':
        if (!taskNumber) {
          return NextResponse.json(
            { error: 'taskNumber is required for checkpoint-with-audit' },
            { status: 400 }
          );
        }
        const evaluationWithAudit = await evaluateCheckpointWithAudit(planId, taskNumber);
        return NextResponse.json({ evaluation: evaluationWithAudit });

      case 'manual-checkpoint':
        if (!taskNumber || !result) {
          return NextResponse.json(
            { error: 'taskNumber and result are required for manual-checkpoint' },
            { status: 400 }
          );
        }
        const manualEvaluation = await manualCheckpointEvaluation(
          planId,
          taskNumber,
          result,
          reasoning || ''
        );
        return NextResponse.json({ evaluation: manualEvaluation });

      case 'pause':
        const paused = await pausePlan(planId);
        return NextResponse.json({ plan: paused });

      case 'resume':
        const resumed = await resumePlan(planId);
        return NextResponse.json({ plan: resumed });

      case 'branch':
        if (!newPlanType || !reason) {
          return NextResponse.json(
            { error: 'newPlanType and reason are required for branch' },
            { status: 400 }
          );
        }
        const branched = await branchPlan(planId, newPlanType, reason);
        return NextResponse.json({ plan: branched });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

