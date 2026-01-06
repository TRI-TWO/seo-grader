import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  pausePlay,
  resumePlay,
  branchPlay,
  getNextStep,
} from '@/lib/smokey/decision';
import { executePlayStep } from '@/lib/smokey/executor';
import {
  evaluateCheckpoint,
  evaluateCheckpointWithAudit,
  manualCheckpointEvaluation,
} from '@/lib/smokey/checkpoint';
import { PlayType, CheckpointResult } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { playId: string } }
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { playId } = params;
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action'); // 'next-step'

  try {
    if (action === 'next-step') {
      const nextStep = await getNextStep(playId);
      return NextResponse.json({ nextStep });
    } else {
      return NextResponse.json(
        { error: 'Invalid action parameter' },
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

export async function POST(
  req: NextRequest,
  { params }: { params: { playId: string } }
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { playId } = params;

  try {
    const body = await req.json();
    const { action, stepNumber, playType, reason, checkpointResult, reasoning } =
      body;

    if (action === 'execute-step') {
      if (!stepNumber) {
        return NextResponse.json(
          { error: 'stepNumber is required' },
          { status: 400 }
        );
      }

      const results = await executePlayStep(playId, stepNumber);
      return NextResponse.json({ results });
    } else if (action === 'checkpoint') {
      if (!stepNumber) {
        return NextResponse.json(
          { error: 'stepNumber is required' },
          { status: 400 }
        );
      }

      const evaluation = await evaluateCheckpoint(playId, stepNumber);
      return NextResponse.json({ evaluation });
    } else if (action === 'checkpoint-with-audit') {
      if (!stepNumber) {
        return NextResponse.json(
          { error: 'stepNumber is required' },
          { status: 400 }
        );
      }

      const evaluation = await evaluateCheckpointWithAudit(playId, stepNumber);
      return NextResponse.json({ evaluation });
    } else if (action === 'manual-checkpoint') {
      if (!stepNumber || !checkpointResult) {
        return NextResponse.json(
          { error: 'stepNumber and checkpointResult are required' },
          { status: 400 }
        );
      }

      const evaluation = await manualCheckpointEvaluation(
        playId,
        stepNumber,
        checkpointResult as CheckpointResult,
        reasoning || ''
      );
      return NextResponse.json({ evaluation });
    } else if (action === 'branch') {
      if (!playType) {
        return NextResponse.json(
          { error: 'playType is required for branching' },
          { status: 400 }
        );
      }

      if (!Object.values(PlayType).includes(playType)) {
        return NextResponse.json(
          { error: `Invalid playType: ${playType}` },
          { status: 400 }
        );
      }

      const newPlay = await branchPlay(
        playId,
        playType as PlayType,
        reason || 'Checkpoint failed'
      );
      return NextResponse.json({ newPlay });
    } else if (action === 'pause') {
      const play = await pausePlay(playId);
      return NextResponse.json({ play });
    } else if (action === 'resume') {
      const play = await resumePlay(playId);
      return NextResponse.json({ play });
    } else {
      return NextResponse.json(
        { error: 'Invalid action parameter' },
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

