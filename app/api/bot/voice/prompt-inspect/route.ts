import { NextRequest, NextResponse } from 'next/server';
import { buildVoicePromptInspectResult } from '@/lib/bot/voicePromptInspect';

export const runtime = 'nodejs';

type Body = {
  botClientId?: string;
};

/**
 * Dev/admin-only: inspect final Realtime instructions without calling OpenAI.
 *
 * - Local: allowed when NODE_ENV === 'development'.
 * - Non-dev: set BOT_VOICE_PROMPT_INSPECT_SECRET and send header
 *   x-bot-voice-prompt-inspect-secret with the same value.
 */
function isPromptInspectAllowed(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  const secret = process.env.BOT_VOICE_PROMPT_INSPECT_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const header = req.headers.get('x-bot-voice-prompt-inspect-secret')?.trim();
  return header === secret;
}

export async function POST(req: NextRequest) {
  if (!isPromptInspectAllowed(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

    const result = await buildVoicePromptInspectResult(botClientId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'botClientId is required') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const isNotFound = message.includes('bot_clients row not found');
    console.error('Voice prompt inspect failed', err);
    return NextResponse.json(
      { error: message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
