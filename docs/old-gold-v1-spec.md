# OLD GOLD V1 Scope Lock + Step 2 Kickoff

## V1 Boundary

### In Scope (V1 Only)
- Inbound call comes in
- Bot answers
- Bot greets caller
- Bot collects lead info
- Bot confirms details
- Bot sends SMS confirmation
- Bot sends internal Slack + email alert
- Bot writes lead into TRI-TWO CRM
- Bot offers callback request / preferred time

### Not In Scope (Deferred After V1)
- Full dispatching
- Quoting
- Deep trade-specific troubleshooting
- Advanced round robin
- Multilingual
- Perfect client UI polish

## Required Lead Intake Schema

Use this as the required lead intake structure:

- `client_account`
- `caller_name`
- `caller_phone`
- `service_type`
- `project_description`
- `service_address`
- `city`
- `state`
- `zip`
- `is_emergency`
- `preferred_callback_time`
- `budget_notes`
- `lead_source`
- `call_summary`
- `call_status`
- `sms_sent`
- `email_sent`
- `slack_sent`
- `crm_logged`
- `created_at`

## First Call Script (Draft V1)

Hi, thanks for calling [Business Name]. I can help get your information over to the team and arrange a callback.

Can I start with your name?

What is the best phone number for a callback?

What type of project or service do you need help with today?

What is the service address?

Is this urgent, or is this a standard quote or service request?

Do you have a preferred callback time today or tomorrow?

Thanks, I've got that down as:
Name: [name]
Phone: [phone]
Project: [project]
Address: [address]
Urgency: [urgency]
Preferred callback: [time]

Our team will follow up shortly. You'll also receive a confirmation text.

## V1 CUSTOMER SERVICE BOT ACCEPTANCE CHECKLIST

- [ ] Answer inbound call
- [ ] Capture caller name
- [ ] Capture callback number
- [ ] Capture service/project need
- [ ] Capture service address
- [ ] Capture urgency
- [ ] Capture preferred callback time
- [ ] Confirm details back to caller
- [ ] Send post-call SMS
- [ ] Send Slack notification
- [ ] Send internal email summary
- [ ] Log lead into TRI-TWO CRM

## Step 2 Kickoff Prompt (Supabase + Webhook Data Model Only)

We are building V1 of a home services AI customer service bot for TRI-TWO.

Do not build final production complexity.
Build only the V1 intake system.

V1 requirements:
- Answer inbound call
- Capture caller name
- Capture callback number
- Capture service/project need
- Capture service address
- Capture urgency
- Capture preferred callback time
- Confirm details back to caller
- Send post-call SMS
- Send Slack notification
- Send internal email summary
- Log lead into TRI-TWO CRM

First, create the data model only.
Return:
1. Supabase table recommendations
2. Required fields for each table
3. Suggested status enums
4. Minimal webhook flow outline

Do not write the full app yet.

Send me what Cursor gives back, and I'll tighten it into the actual schema.

## Step 2 Working Draft (Schema + Webhook Outline)

### 1) Supabase table recommendations
- `leads`: one row per qualified inbound lead intake.
- `call_logs`: one row per call attempt/session (raw call metadata + transcript pointers).
- `timeline_events`: append-only event stream for lead lifecycle and delivery attempts.

### 2) Required fields for each table

#### `leads`
- `id` (uuid, pk)
- `client_account` (text, not null)
- `caller_name` (text, not null)
- `caller_phone` (text, not null)
- `service_type` (text, not null)
- `project_description` (text, not null)
- `service_address` (text, not null)
- `city` (text, not null)
- `state` (text, not null)
- `zip` (text, not null)
- `is_emergency` (boolean, not null, default false)
- `preferred_callback_time` (timestamptz, nullable)
- `budget_notes` (text, nullable)
- `lead_source` (text, not null, default 'inbound_call_bot')
- `call_summary` (text, not null)
- `call_status` (lead_call_status enum, not null)
- `sms_sent` (boolean, not null, default false)
- `email_sent` (boolean, not null, default false)
- `slack_sent` (boolean, not null, default false)
- `crm_logged` (boolean, not null, default false)
- `created_at` (timestamptz, not null, default now())

#### `call_logs`
- `id` (uuid, pk)
- `lead_id` (uuid, fk -> leads.id, nullable until lead is created)
- `client_account` (text, not null)
- `provider_call_id` (text, unique, not null)
- `from_phone` (text, not null)
- `to_phone` (text, not null)
- `started_at` (timestamptz, not null)
- `ended_at` (timestamptz, nullable)
- `duration_seconds` (integer, nullable)
- `transcript` (text, nullable)
- `recording_url` (text, nullable)
- `intake_completed` (boolean, not null, default false)
- `created_at` (timestamptz, not null, default now())

#### `timeline_events`
- `id` (uuid, pk)
- `lead_id` (uuid, fk -> leads.id, not null)
- `call_log_id` (uuid, fk -> call_logs.id, nullable)
- `event_type` (timeline_event_type enum, not null)
- `event_status` (event_status enum, not null)
- `channel` (text, nullable)  // sms | email | slack | crm | voice
- `payload` (jsonb, nullable) // provider responses, error metadata
- `occurred_at` (timestamptz, not null, default now())

### 3) Suggested status enums

#### `lead_call_status`
- `new`
- `intake_in_progress`
- `intake_completed`
- `callback_requested`
- `closed`

#### `timeline_event_type`
- `call_answered`
- `intake_started`
- `intake_completed`
- `sms_confirmation_sent`
- `slack_alert_sent`
- `email_summary_sent`
- `crm_lead_logged`
- `callback_offered`
- `callback_time_captured`

#### `event_status`
- `queued`
- `sent`
- `succeeded`
- `failed`

### 4) Minimal webhook flow outline
1. Telephony provider webhook (`call.started`) creates `call_logs` row and marks event `call_answered`.
2. Voice agent runs scripted intake and stores transcript data in `call_logs`.
3. On intake confirmation, server upserts `leads` record with required V1 fields.
4. Post-call fan-out triggers:
   - SMS confirmation send -> timeline event
   - Slack alert send -> timeline event
   - Internal email summary send -> timeline event
   - CRM write -> timeline event
5. Boolean delivery fields (`sms_sent`, `slack_sent`, `email_sent`, `crm_logged`) are updated on `leads` based on event outcomes.
6. If callback time is captured, set `preferred_callback_time`, `call_status=callback_requested`, and write callback event.
