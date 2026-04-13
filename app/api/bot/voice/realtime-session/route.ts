import { NextRequest, NextResponse } from 'next/server';
import { initBotRealtimeVoiceSession } from '@/lib/bot/initBotRealtimeVoiceSession';
import { isOpenAIRealtimeSessionCreateError } from '@/lib/bot/openaiRealtimeSession';

export const runtime = 'nodejs';

type Body = {
  botClientId?: string;
};

export async function POST(req: NextRequest) {
  try {
    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const botClientId = typeof body.botClientId === 'string' ? body.botClientId.trim() : '';
    if (!botClientId) {
      return NextResponse.json({ error: 'botClientId is required' }, { status: 400 });
    }

    const result = await initBotRealtimeVoiceSession(botClientId);

    return NextResponse.json({
      ...result.session,
      _meta: {
        botClientId: result.botClientId,
        promptVersion: result.promptVersion,
        tradeType: result.tradeType,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isNotFound = message.includes('bot_clients row not found');
    const upstreamSession = isOpenAIRealtimeSessionCreateError(err);
    console.error('Realtime voice session init failed', err);
    const status = isNotFound ? 404 : upstreamSession ? 503 : 500;
    return NextResponse.json(
      {
        error: message,
        ...(upstreamSession ? { sessionInitFailure: true, kind: err.kind } : {}),
      },
      { status }
    );
  }
}
