## Arch seed and testing notes

### 1. Run migrations

Ensure Supabase has the latest schema:

- `20260224090000_arch_schema.sql` – creates `arch_*` tables.
- `20260224090001_arch_rls.sql` – enables RLS and service-role policies.
- `20260224090002_arch_capabilities.sql` – adds `use_arch_dashboard` and `configure_arch` capabilities and assigns them to tiers.

Apply these along with existing migrations using your normal Supabase migration flow.

### 2. Seed a demo client with Arch configuration

Pick an existing `Client` row (from Prisma `Client` model) you want to use for testing and note its `id`.

In the Supabase SQL editor, run a minimal seed for that client:

```sql
-- Replace this with a real client id
SELECT '00000000-0000-0000-0000-000000000000'::uuid AS demo_client_id;
```

Then insert:

```sql
-- Arch client config
INSERT INTO arch_clients (client_id, is_enabled, timezone)
VALUES ('00000000-0000-0000-0000-000000000000', true, 'America/New_York')
ON CONFLICT DO NOTHING;

-- Minimal categories
INSERT INTO arch_categories (client_id, key, label, weight, sort_order, is_enabled)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'technical_seo', 'Technical SEO', 1, 0, true),
  ('00000000-0000-0000-0000-000000000000', 'content', 'Content', 1, 1, true)
ON CONFLICT DO NOTHING;

-- Look up category ids
WITH c AS (
  SELECT id, key
  FROM arch_categories
  WHERE client_id = '00000000-0000-0000-0000-000000000000'
)
INSERT INTO arch_signals (client_id, category_id, key, label, weight, direction, unit, is_enabled)
SELECT
  '00000000-0000-0000-0000-000000000000',
  c.id,
  CASE c.key
    WHEN 'technical_seo' THEN 'core_web_vitals_status'
    ELSE 'organic_traffic_trend'
  END AS key,
  CASE c.key
    WHEN 'technical_seo' THEN 'Core Web Vitals status'
    ELSE 'Organic traffic trend'
  END AS label,
  1,
  'higher_is_better',
  NULL,
  true
FROM c
ON CONFLICT DO NOTHING;

-- Simple rules: one good and one bad threshold per signal
WITH s AS (
  SELECT id, client_id, key
  FROM arch_signals
  WHERE client_id = '00000000-0000-0000-0000-000000000000'
)
INSERT INTO arch_rules (
  client_id,
  signal_id,
  rule_type,
  operator,
  threshold,
  points,
  message,
  action_title,
  action_detail,
  severity,
  is_enabled
)
SELECT
  s.client_id,
  s.id,
  'threshold',
  '>=',
  80,
  10,
  'Signal is healthy',
  'Maintain current performance',
  NULL,
  'info',
  true
FROM s
UNION ALL
SELECT
  s.client_id,
  s.id,
  'threshold',
  '<',
  50,
  -15,
  'Signal is underperforming',
  'Investigate and remediate this area',
  NULL,
  'warning',
  true
FROM s;
```

### 3. Seed daily signal values for testing

For the same demo client, create a short history of `arch_signal_values`:

```sql
WITH s AS (
  SELECT id, client_id, key
  FROM arch_signals
  WHERE client_id = '00000000-0000-0000-0000-000000000000'
),
dates AS (
  SELECT (current_date - offs) AS as_of_date
  FROM generate_series(0, 14) AS offs
)
INSERT INTO arch_signal_values (client_id, signal_id, as_of_date, value, source, metadata)
SELECT
  s.client_id,
  s.id,
  d.as_of_date,
  CASE s.key
    WHEN 'core_web_vitals_status' THEN 70 + (random() * 20)::int
    ELSE 60 + (random() * 30)::int
  END AS value,
  'seed',
  '{}'::jsonb
FROM s
CROSS JOIN dates
ON CONFLICT (client_id, signal_id, as_of_date) DO NOTHING;
```

### 4. Generate snapshots for the demo client

With values and rules in place, run `computeArchScore` for a window of dates.

From a temporary script (e.g. a one-off Next.js route or a Node script), you can do:

```ts
import { computeArchScore } from "@/lib/arch/score";

async function seedArchSnapshots(clientId: string) {
  const today = new Date();

  for (let i = 0; i < 15; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    // This will upsert into arch_snapshots and possibly arch_events
    await computeArchScore(clientId, iso, { dryRun: false, maxDriversPerSide: 5 });
  }
}
```

Run this once for the demo client id.

### 5. Manual verification flows

**As admin (internal TRI-TWO):**

- Visit `/admin` and click the **Arch** tile.
- Select the seeded demo client from the dropdown.
- On the **Configuration** tab, verify:
  - Categories and signals appear as seeded.
  - Client metadata (tier, status, URL) matches expectations.
- On the **Signals & Rules** tab, verify:
  - Threshold rules are listed with points and messages.
- On the **Preview** tab:
  - Click **Preview Score** and confirm a non-zero `overallScore`.
  - Category scores JSON reflects categories you seeded.

**As client user:**

- Ensure the user has a tier with the `use_arch_dashboard` capability (growth or enterprise).
- Log in as that user (mapped to the demo client via email).
- Visit `/arch`:
  - Overall health score and band render.
  - Category cards show per-category scores.
  - Trend chart displays the 15 seeded days.
  - Drivers and recommended actions reflect rules you configured.
  - Recent events show any large score deltas.

### 6. Edge cases to spot-check

- Client with Arch disabled (no `arch_clients` row): `/arch` should not render for that user until configuration exists.
- Client with no signal values: `/arch` should render a score of `0` and explanatory empty states, not crash.
- Admin hitting `/api/admin/arch/compute` with `dryRun: true` should not create new events but should still return a snapshot payload.

