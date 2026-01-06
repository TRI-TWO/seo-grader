import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createToolSession, launchToolSession, buildToolPayload } from '@/lib/smokey/toolSessions';

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, taskId, tool, payload } = body;

    if (action === 'create') {
      if (!taskId || !tool) {
        return NextResponse.json(
          { error: 'taskId and tool are required' },
          { status: 400 }
        );
      }

      // Build payload if not provided
      const finalPayload = payload || await buildToolPayload(taskId, tool);
      const session = await createToolSession(taskId, tool, finalPayload);
      return NextResponse.json({ session });
    } else if (action === 'launch') {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json(
          { error: 'sessionId is required' },
          { status: 400 }
        );
      }

      const result = await launchToolSession(sessionId);
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "create" or "launch"' },
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
