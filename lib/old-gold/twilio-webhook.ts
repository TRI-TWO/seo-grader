import crypto from 'crypto';

export type TwilioIncomingPayload = {
  CallSid: string;
  From: string;
  To: string;
  CallStatus?: string;
  AccountSid?: string;
  Direction?: string;
  ApiVersion?: string;
  ForwardedFrom?: string;
};

export type TwilioStatusPayload = {
  CallSid: string;
  CallStatus?: string;
  CallDuration?: string;
  Timestamp?: string;
  From?: string;
  To?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
  RecordingStatus?: string;
  SpeechResult?: string;
};

export const TERMINAL_CALL_STATUSES = new Set([
  'completed',
  'busy',
  'no-answer',
  'failed',
  'canceled',
]);

export async function parseTwilioFormPayload(req: Request): Promise<Record<string, string>> {
  const formData = await req.formData();
  const data: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      data[key] = value;
    }
  }

  return data;
}

export function getTwilioSignature(req: Request): string | null {
  const signature = req.headers.get('x-twilio-signature');
  if (!signature) return null;
  const trimmed = signature.trim();
  return trimmed || null;
}

export function shouldValidateTwilioSignature(): boolean {
  return String(process.env.TWILIO_WEBHOOK_VALIDATE || '').toLowerCase() === 'true';
}

export function buildTwilioValidationUrl(req: Request): string {
  const overrideBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL?.trim();
  if (overrideBaseUrl) {
    const reqUrl = new URL(req.url);
    return `${overrideBaseUrl.replace(/\/+$/, '')}${reqUrl.pathname}`;
  }
  return req.url;
}

export function isTwilioSignatureValid(args: {
  url: string;
  params: Record<string, string>;
  authToken: string;
  twilioSignature: string;
}): boolean {
  const { url, params, authToken, twilioSignature } = args;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + (params[key] ?? '');
  }

  const expected = crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(twilioSignature);

  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export function normalizePhone(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;

  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

export function parseDurationSeconds(value?: string): number | null {
  if (!value) return null;
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

export function getOptionalTimelineEventType(status?: string): string | null {
  switch ((status || '').toLowerCase()) {
    case 'in-progress':
      return 'intake_started';
    case 'completed':
      return 'intake_completed';
    default:
      return null;
  }
}

export function validateIncomingPayload(payload: Partial<TwilioIncomingPayload>): {
  ok: true;
  value: TwilioIncomingPayload;
} | {
  ok: false;
  error: string;
} {
  if (!payload.CallSid) return { ok: false, error: 'Missing CallSid' };
  if (!payload.From) return { ok: false, error: 'Missing From' };
  if (!payload.To) return { ok: false, error: 'Missing To' };

  return {
    ok: true,
    value: payload as TwilioIncomingPayload,
  };
}

export function validateStatusPayload(payload: Partial<TwilioStatusPayload>): {
  ok: true;
  value: TwilioStatusPayload;
} | {
  ok: false;
  error: string;
} {
  if (!payload.CallSid) return { ok: false, error: 'Missing CallSid' };

  return {
    ok: true,
    value: payload as TwilioStatusPayload,
  };
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function twimlResponse(message: string): string {
  const escaped = escapeXmlText(message);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escaped}</Say></Response>`;
}

/**
 * TwiML to bridge the call to a bi-directional Media Stream (e.g. OpenAI Realtime gateway).
 * Pass short Parameter values only; avoid logging secrets on the Twilio side when possible.
 */
export function twimlStreamConnectResponse(args: { streamUrl: string; parameters: Record<string, string> }): string {
  const { streamUrl, parameters } = args;
  const urlEscaped = escapeXmlText(streamUrl);
  const paramXml = Object.entries(parameters)
    .map(
      ([name, value]) =>
        `<Parameter name="${escapeXmlText(name)}" value="${escapeXmlText(value)}"/>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${urlEscaped}" track="inbound_track">${paramXml}</Stream></Connect></Response>`;
}
