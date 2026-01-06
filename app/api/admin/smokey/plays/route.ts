import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getActivePlays,
  getActivePlay,
  suggestPlay,
  createPlay,
  getClientPlays,
  getQueuedPlaysForClient,
  getPlaysByMonth,
} from '@/lib/smokey/decision';
import { PlayType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const clientId = searchParams.get('clientId');
  const action = searchParams.get('action'); // 'active' | 'suggest' | 'all'

  if (!clientId) {
    return NextResponse.json(
      { error: 'clientId is required' },
      { status: 400 }
    );
  }

  try {
    if (action === 'active') {
      const plays = await getActivePlays(clientId);
      return NextResponse.json({ plays });
    } else if (action === 'queued') {
      const plays = await getQueuedPlaysForClient(clientId);
      return NextResponse.json({ plays });
    } else if (action === 'suggest') {
      const suggestedPlayType = await suggestPlay(clientId);
      return NextResponse.json({ suggestedPlayType });
    } else if (action === 'all') {
      const plays = await getClientPlays(clientId);
      return NextResponse.json({ plays });
    } else if (action === 'by-month') {
      const month = searchParams.get('month');
      if (!month) {
        return NextResponse.json(
          { error: 'month parameter is required for by-month action' },
          { status: 400 }
        );
      }
      const plays = await getPlaysByMonth(clientId, parseInt(month));
      return NextResponse.json({ plays });
    } else {
      // Default: get all active plays
      const plays = await getActivePlays(clientId);
      return NextResponse.json({ plays });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { clientId, playType, scheduledMonth, dependsOnPlayId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    if (!playType) {
      return NextResponse.json(
        { error: 'playType is required' },
        { status: 400 }
      );
    }

    // Validate play type
    if (!Object.values(PlayType).includes(playType)) {
      return NextResponse.json(
        { error: `Invalid playType: ${playType}` },
        { status: 400 }
      );
    }

    const play = await createPlay(
      clientId,
      playType as PlayType,
      scheduledMonth,
      dependsOnPlayId
    );
    return NextResponse.json({ play });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create play' },
      { status: 500 }
    );
  }
}

