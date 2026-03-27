# OLD GOLD V1 Twilio Webhook Contract

This document defines the V1 webhook contract for intake-only call handling.

## Scope

- In scope: inbound call intake, `call_logs` writes, conditional `leads` creation, `timeline_events` append
- Out of scope: dispatching, quoting, advanced routing, trade-specific decision trees

## Endpoint 1: `POST /api/twilio/voice/incoming`

### Purpose
Accept the first inbound Twilio Voice webhook for a call, create or update the `call_logs` record, and return the immediate voice response instructions for intake start.

### Expected Request Source
- Twilio Programmable Voice webhook (`Voice URL`) for inbound calls.
- Content type: `application/x-www-form-urlencoded`.

### Expected Request Fields (V1)
Required:
- `CallSid` (string, Twilio unique call ID)
- `From` (string, caller number)
- `To` (string, business number that was called)

Optional (if present, persist):
- `CallStatus` (string)
- `AccountSid` (string)
- `Direction` (string)
- `ApiVersion` (string)
- `ForwardedFrom` (string)

Derived/Server-resolved:
- `client_account` (resolve from `To` phone number mapping)
- `started_at` (server now if not already set)

### Validation Rules
1. Reject if `CallSid`, `From`, or `To` is missing.
2. Normalize `From` and `To` into E.164-like format for storage consistency.
3. Resolve `client_account` from `To`:
   - if no match, treat as unsupported destination number.
4. Idempotency key is `CallSid` (`twilio_call_sid`):
   - insert on first seen
   - update if already exists

### Database Writes
Table: `call_logs`
- Upsert by `twilio_call_sid`.
- On insert:
  - `twilio_call_sid`, `from_phone`, `to_phone`, `client_account`, `started_at`, `created_at`, `updated_at`
  - `intake_completed = false`
- On update:
  - refresh `updated_at`
  - patch any newly received metadata fields (non-destructive)

Table: `timeline_events` (append)
- Append `event_type = 'call_answered'`
- `lead_id = null` for now (if lead not created yet)
- `call_log_id` linked to `call_logs.id`
- `channel = 'voice'`
- `payload` includes `CallSid`, normalized phones, and resolved `client_account`

### Response Behavior
- On success: return TwiML quickly (HTTP 200) to continue intake flow.
- V1 behavior: simple greeting + transition to intake questions (no routing tree).

### Failure Behavior
- Validation failure: return safe TwiML fallback (brief apology + callback promise), HTTP 200 to avoid Twilio retries for malformed requests.
- DB failure/transient error: return HTTP 500 only if durable write cannot be made.
- Always log structured error with `CallSid` correlation.

## Endpoint 2: `POST /api/twilio/voice/status`

### Purpose
Process Twilio status callbacks during/after the call, update `call_logs`, and conditionally create/update `leads` and append `timeline_events`.

### Expected Request Source
- Twilio Voice `StatusCallback`.
- Content type: `application/x-www-form-urlencoded`.

### Expected Request Fields (V1)
Required:
- `CallSid` (string)
- `CallStatus` (string; e.g. ringing/in-progress/completed/busy/no-answer/failed/canceled)

Optional:
- `CallDuration` (string/integer seconds)
- `Timestamp` (string)
- `From`, `To` (strings; fallback data)
- `RecordingUrl` (string)
- `RecordingSid` (string)
- `RecordingStatus` (string)
- `SpeechResult` or transcript reference fields if configured

V1 intake payload source:
- Parsed intake summary (from voice flow state/store) when available:
  - `caller_name`
  - `caller_phone`
  - `service_type`
  - `project_description`
  - `service_address`
  - `city`
  - `state`
  - `zip`
  - `is_emergency`
  - `preferred_callback_notes` (or mapped callback preference)
  - `budget_notes`
  - `call_summary`

### Validation Rules
1. Reject if `CallSid` is missing.
2. `CallStatus` must be in allowed Twilio status set for V1.
3. Find `call_logs` by `twilio_call_sid`; if not found:
   - create a minimal `call_logs` row (late status callback tolerance).
4. Idempotent updates:
   - repeated callbacks with same status should not duplicate side effects.

### Database Writes
Table: `call_logs` (update/create)
- Update by `twilio_call_sid`:
  - `ended_at` when terminal status arrives
  - `duration_seconds` from `CallDuration` when provided
  - `recording_url` when provided
  - `call_outcome` from terminal `CallStatus`
  - `transcript` if available
  - `updated_at` always

Table: `leads` (conditional create/update)
- Create only when V1 minimum intake completeness is met (see Lead Creation Rules).
- Set:
  - canonical intake fields
  - `lead_source = 'inbound_call_bot'`
  - `call_status` according to V1 mapping
  - `sms_sent`, `email_sent`, `slack_sent`, `crm_logged` initially `false` until downstream actions succeed
- If lead already exists for this call, update missing fields only (do not blank existing data).

Table: `timeline_events` (append)
- Append status and lifecycle events, including:
  - `intake_started` (first in-progress signal)
  - `intake_completed` (when minimum fields satisfied)
  - `callback_requested` (if callback preference captured)
  - `callback_scheduled` (if explicit callback time captured)
  - `sms_sent` / `slack_sent` / `email_sent` / `crm_logged` as downstream integrations complete
- `payload` includes small operational metadata (status, retry count, external IDs, error if any).

### Response Behavior
- Return HTTP 200 quickly once request is validated and write attempt is made.
- Do not block Twilio callback on downstream sends (SMS/Slack/email/CRM can be async).

### Failure Behavior
- If parse/validation fails: return HTTP 400, log with `CallSid`.
- If DB write fails: return HTTP 500 so Twilio can retry.
- For downstream side-effect failures (SMS/email/Slack/CRM):
  - keep webhook response 200 if `call_logs` update succeeded
  - append failure event in `timeline_events`
  - leave corresponding lead boolean (`sms_sent`, etc.) as `false`

## Ordered Call Lifecycle (V1)

1. Twilio receives inbound call to tracked number.
2. Twilio calls `POST /api/twilio/voice/incoming`.
3. Server resolves `client_account` from `To` number.
4. `call_logs` is created/upserted by `twilio_call_sid`.
5. `timeline_events` appends `call_answered`.
6. Voice intake flow collects caller details.
7. Twilio sends one or more `POST /api/twilio/voice/status` callbacks.
8. `call_logs` is updated with status, duration, transcript/recording pointers.
9. If intake complete, create/update `leads`.
10. Append `timeline_events` for intake and callback preference milestones.
11. Trigger post-call fan-out (SMS/Slack/email/CRM), append event rows per outcome.

## Lead Creation Rules (V1)

Create `leads` only when all minimum fields are present:
- `client_account`
- `caller_phone`
- `service_type` OR `project_description` (at least one meaningful service intent)
- `service_address` (or address components sufficient for follow-up)
- `is_emergency`
- `call_summary`

Recommended additional fields before finalizing intake:
- `caller_name`
- callback preference (`preferred_callback_notes` or equivalent mapped value)

`call_status` mapping (V1):
- default on create: `new`
- while intake is still active: `intake_in_progress`
- when minimum intake captured and confirmed: `intake_completed`
- if callback requested: `callback_requested`
- if callback time is explicitly scheduled: `callback_scheduled`
- terminal non-actionable: `closed`

## Timeline Event Append Rules (V1)

Append `timeline_events` at these points:
1. `call_answered` when incoming webhook accepted.
2. `intake_started` when first intake prompt/state is entered.
3. `intake_completed` when minimum lead fields validated.
4. `callback_requested` when caller asks for callback.
5. `callback_scheduled` when callback window/time is captured.
6. `sms_sent` / `slack_sent` / `email_sent` / `crm_logged` as each action succeeds.

Payload guidance (V1):
- Keep payload compact JSONB:
  - identifiers (`CallSid`, integration message IDs)
  - status snapshots
  - retry count
  - last error message (when failed)

## Incomplete Intake Handling (V1)

If intake is incomplete at call end:
- Always persist/update `call_logs`.
- Do not force a full `leads` row.
- Append a timeline event indicating incomplete intake outcome (use existing event taxonomy and include `payload.incomplete = true`).

If callback requested but required lead fields are incomplete:
- Keep request in `call_logs` + `timeline_events`.
- Mark for follow-up in operations queue outside schema expansion (no new V1 tables).
- Create lead only after minimum required fields are available.

Failure posture for incomplete calls:
- Never drop call traceability.
- Preserve partial transcript/summary in `call_logs`.
- Keep webhook idempotent so repeated status callbacks converge to same stored state.
