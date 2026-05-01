# TRI-TWO Architecture Rules

TRI-TWO is a trust-grade AI front desk operating system for local service businesses.
The product goal is operational outcomes: recover missed leads, qualify callers, coordinate callbacks, notify owners, and produce reliable structured records.

These are build gates, not suggestions.

## Non-Negotiable Build Gates

1. **Trust-first voice behavior**: one question at a time, concise prompts, interruption-safe turn handling, no fabricated details.
2. **Deterministic flow control**: use explicit FSM states and transitions for intake, retries, confirmations, and closeout.
3. **Critical-slot confirmation required**: never advance critical data without validation and explicit lock (`name`, `address`, `callback phone`, `callback window`).
4. **No hallucinated commitments**: never promise pricing, scheduling, or dispatch unless tenant policy explicitly allows it.
5. **Data integrity over speed**: prefer reprompt/confirm over guessing when transcript quality is ambiguous.
6. **Strict tenant isolation**: all persisted operational records and workflow execution paths must be tenant-scoped (`client_id`).
7. **Transport/provider abstraction**: voice transport (Twilio or alternative) must remain replaceable behind adapter boundaries.
8. **AI for judgment, code for operations**: deterministic code handles side effects, retries, routing, and persistence.
9. **Failure-safe design required**: include retry budgets, loop breakers, fallback paths, and escalation points before expanding feature scope.
10. **Observability is mandatory**: log transitions, validation failures, slot writes, and call outcomes in structured form for post-call debugging.

## Enforcement

- Any change that violates a gate must be blocked or rewritten before merge.
- If a tradeoff is unavoidable, document it explicitly and add a mitigation path in the same change.
