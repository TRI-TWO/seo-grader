# OLD GOLD V1 — Step 6: Proof of concept + post-POC scalability

**Source of truth (V1):**

- [old-gold-v1-spec.md](./old-gold-v1-spec.md)
- [old-gold-v1-webhook-contract.md](./old-gold-v1-webhook-contract.md)

This document is the minimum operational guide for the **first live Twilio inbound call** test, plus a **documentation-only** scalability outline for after POC. It does not expand V1 product scope.

**V1 rules in scope:** no AI logic, no lead creation, no Slack/email/SMS, no scheduling, no non-V1 tables. `call_logs` on inbound; `timeline_events` appendable with nullable `lead_id`; `client_account` is currently the normalized called number fallback; status handler returns **404** if no matching `call_logs` row.

---

## PART A — Proof of concept execution prep

### 1) Exact env vars for first live test

| Variable | Value for first live test | Notes |
|----------|---------------------------|--------|
| `DATABASE_URL` | Your Postgres connection string (same DB the deployed/tunneled app uses) | Required for Prisma raw SQL to `call_logs` / `timeline_events`. |
| `TWILIO_WEBHOOK_VALIDATE` | **Unset** or **`false`** | Keeps signature checks off until the first successful external webhook pass. |
| `TWILIO_AUTH_TOKEN` | Optional during first test | Needed when you turn validation on. |
| `TWILIO_WEBHOOK_BASE_URL` | Optional during first test | After POC: set to exact public origin (e.g. `https://your-app.vercel.app`) when enabling validation. |

### 2) Exact Twilio console settings

Configure on the **Twilio phone number** used for OLD GOLD:

1. **Voice & Fax** (or **Configure** for the number):
   - **A call comes in**: **Webhook**
   - **URL**: `https://<your-public-host>/api/twilio/voice/incoming`
   - **HTTP**: **POST**
2. **Status callback** (same number or voice config, per Twilio UI):
   - **Status callback URL**: `https://<your-public-host>/api/twilio/voice/status`
   - **HTTP**: **POST**
   - Subscribe to status events that include at least **completed** (and ideally earlier states such as ringing / in-progress) so you can observe lifecycle updates.

Replace `<your-public-host>` with your **production**, **preview**, or **tunnel** hostname. Twilio cannot POST to `localhost` without a tunnel.

### 3) First-call verification checklist

**Before**

- [ ] App is reachable at **HTTPS** from the public internet (deploy or tunnel).
- [ ] `DATABASE_URL` is set on that environment.
- [ ] `TWILIO_WEBHOOK_VALIDATE` is off (`false` or unset).
- [ ] OLD GOLD migrations applied: `public.call_logs`, `public.timeline_events`, `timeline_events.lead_id` nullable.
- [ ] Incoming webhook URL and status callback URL match the host you will query in the DB.

**During**

- [ ] Place one inbound call to the Twilio number.
- [ ] Let the call proceed so Twilio posts **incoming** at least once and **status** after hangup or completion.

**After**

- [ ] Exactly one `call_logs` row for the Twilio `CallSid` (or upsert semantics if Twilio retries incoming).
- [ ] At least one `timeline_events` row with `event_type = 'call_answered'` for that call.
- [ ] After terminal status, `call_logs` shows updated `call_outcome`, `duration_seconds` if sent, `ended_at` when terminal.
- [ ] Optional extra timeline rows for mapped statuses (e.g. `intake_started` / `intake_completed`) per route logic.
- [ ] **No new `leads` rows** from this test (lead creation not implemented yet).

### 4) Exact SQL verification queries

Replace `CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` with the real **CallSid** from Twilio logs or your server logs.

**Latest matching `call_logs` row**

```sql
select *
from public.call_logs
where twilio_call_sid = 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
order by updated_at desc
limit 1;
```

**Related `timeline_events` rows**

```sql
select te.id, te.event_type, te.lead_id, te.call_log_id, te.channel, te.payload, te.occurred_at
from public.timeline_events te
join public.call_logs cl on cl.id = te.call_log_id
where cl.twilio_call_sid = 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
order by te.occurred_at asc;
```

**Confirm no leads created (spot check — adjust time window as needed)**

```sql
select id, client_account, caller_phone, created_at
from public.leads
where created_at > now() - interval '2 hours'
order by created_at desc;
```

Expect **zero rows** (or none tied to this POC if you have unrelated test data).

### 5) Code / config gotchas for first test

- **404 on status**: Incoming route never ran or failed → no `call_logs` row → status returns 404. Fix Twilio Voice URL, deployment, or errors on `/incoming`.
- **Wrong database**: Preview deployment `DATABASE_URL` differs from the DB you query in SQL editor.
- **Localhost**: Twilio cannot hit `http://localhost:3000` without a tunnel; use public HTTPS URL.
- **Signature on too early**: `TWILIO_WEBHOOK_VALIDATE=true` without matching URL (`TWILIO_WEBHOOK_BASE_URL`) → 401 on Twilio retries.
- **Repeat `call_answered` events**: Multiple incoming webhook deliveries may append multiple `call_answered` rows; acceptable for POC; dedupe can wait for scalability phase.
- **Normalize phones**: Stored values are normalized in routes; compare using normalized form in logs/SQL if debugging mismatches.

### 6) First-test risks (summary)

- Misconfigured Voice URL vs Status URL (different hosts or paths).
- CallSid mismatch between manual SQL and actual call.
- Environment drift between local docs and deployed env vars.
- Twilio-only partial status payload on some carriers (fewer fields; still should get `CallSid` + terminal status).

---

## PART B — POST-POC SCALABILITY PLAN

*Documentation only. No implementation commitment in this file.*

### 1) Multiple client business numbers

- Maintain a **registry** of Twilio (or client-owned) DIDs mapped to TRI-TWO `client_account` / org identifiers.
- **Phase 1 (scale-up):** config table or key-value store: `e164_to_client` with effective dates; inbound webhook resolves `To` → `client_account` before writes.
- **Phase 2:** Admin UI to assign numbers; audit log of changes.

### 2) Client onboarding paths

- **Forward existing number:** Client forwards carrier number to a TRI-TWO Twilio DID. Fastest; no port. Mapping is on **our** DID (`To` in webhooks).
- **Port later:** Number becomes Twilio-hosted; same mapping layer, update registry when port completes; avoid hard-coding `client_account` from raw `To` in app long-term.

### 3) Number-to-client mapping design

- Single function: `resolveClientAccount(e164ToNumber) → client_account_id` (fail closed or “unmapped” bucket with alerts).
- Store **normalized E.164** as canonical keys.
- Support many-to-one (multiple numbers → one client) for franchises or regional lines.

### 4) Future lead creation timing

- Create `leads` only when **minimum intake completeness** is met (per V1 spec / webhook contract), not on first ring.
- Link `call_logs.lead_id` after insert; backfill timeline events or leave early events with `lead_id` null and later correlation by `call_log_id`.

### 5) Future notification fan-out

- After durable `leads` row + confirmed intake: async jobs or queue for SMS, Slack, email, CRM.
- Use `timeline_events` as the append-only audit trail per channel with idempotency keys in `payload`.
- Do not block Twilio webhooks on third-party latency.

### 6) Future conversational voice layer

- **Now:** Twilio webhook + TwiML (or simple Twilio Studio) — good for POC and thin intake.
- **Later:** Optional realtime stack (e.g. media streams + separate ASR/LLM service) while **keeping Twilio as PSTN ingress** until a deliberate telephony migration.
- Isolate “conversation state machine” from “persistence layer” so telephony can swap without rewriting CRM writes.

### 7) Future client-specific prompt / config model

- Per-client config: greeting text, business name substitution, allowed services list (lightweight), hours, emergency handling policy, callback policy.
- Version config and log `config_version` on `call_logs` or timeline payload for support debugging.

### 8) Future observability / logs / QA

- Structured logs: `callSid`, `client_account`, route name, latency, DB outcome.
- Dashboards: call volume, intake completion rate, 404 rate on status (indicates missing incoming).
- QA replay: fixture Twilio payloads + transactional DB tests; optional Twilio debugger correlation IDs in `timeline_events.payload`.

---

## Signature validation — after first successful external pass

1. Confirm one full call produces expected `call_logs` + `timeline_events`.
2. Set `TWILIO_WEBHOOK_BASE_URL` to the exact origin Twilio POSTs to (no trailing slash on path fragment mismatch).
3. Set `TWILIO_AUTH_TOKEN` and `TWILIO_WEBHOOK_VALIDATE=true`.
4. Re-test one call; fix URL drift if 401 occurs.

---

## Step 6 return summary (quick)

1. **Checklist** — PART A §3  
2. **Env vars** — PART A §1  
3. **Twilio setup** — PART A §2  
4. **DB SQL** — PART A §4  
5. **Risks** — PART A §6  
6. **Scalability** — PART B  
