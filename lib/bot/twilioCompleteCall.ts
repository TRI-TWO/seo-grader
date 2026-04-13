/**
 * End an in-progress Twilio call via REST (used after single-lane unsupported refusal).
 */

export type TwilioCompleteCallLogContext = Record<string, unknown>;

/**
 * POST Status=completed to the Call resource. Returns false if credentials missing or request failed.
 */
export async function completeTwilioCall(
  callSid: string,
  logContext?: TwilioCompleteCallLogContext
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    console.warn('OPENAI twilio_complete_call_skipped_missing_credentials', {
      callSid,
      ...logContext,
    });
    return false;
  }
  if (!callSid?.trim()) {
    console.warn('OPENAI twilio_complete_call_skipped_empty_call_sid', logContext);
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls/${encodeURIComponent(callSid.trim())}.json`;
  const body = new URLSearchParams({ Status: 'completed' });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('OPENAI twilio_complete_call_http_error', {
        callSid,
        status: res.status,
        bodyPreview: text.slice(0, 300),
        ...logContext,
      });
      return false;
    }
    console.info('OPENAI twilio_complete_call_ok', { callSid, ...logContext });
    return true;
  } catch (err) {
    console.error('OPENAI twilio_complete_call_failed', { callSid, err, ...logContext });
    return false;
  }
}
