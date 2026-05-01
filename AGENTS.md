# Agent instructions (Codex, CLI agents, and similar)

Project: **seo-grader-v3-peach** — Next.js 14 (App Router), TypeScript, Prisma (PostgreSQL), Supabase, custom Node `server.ts` for HTTP + WebSocket (Twilio ↔ OpenAI Realtime voice bridge).

## Commands

| Task | Command |
|------|---------|
| Install deps | `npm install` (runs `prisma generate` via `postinstall`) |
| Dev server | `npm run dev` — runs `tsx server.ts` (custom server; not `next dev` alone) |
| Production build | `npm run build` — `prisma generate && next build` |
| Production start | `npm run start` — `NODE_ENV=production tsx server.ts` |
| Lint | `npm run lint` — `next lint` |
| Prisma: push schema to DB | `npm run db:push` |
| Prisma: deploy migrations | `npm run db:migrate` |

**Unit tests (TypeScript, `node:test` — no `npm test` script):** run all current bot unit tests (copy-paste friendly):

```bash
node --import tsx --test \
  lib/bot/kitchenSinkLeakOnlyValidators.test.ts \
  lib/bot/kitchenSinkLeakOnlyStateMachine.test.ts \
  lib/bot/kitchenSinkLeakOnlyBridge.test.ts
```

In zsh/bash you can also use: `node --import tsx --test lib/bot/*.test.ts`

**One-off SQL helpers** (use only when the task explicitly requires them; they mutate the DB): `db:fix-audits-fk`, `db:fix-public-auth-fks`, `db:link-arch-user` — see `package.json` and `prisma/scripts/`.

## Environment

- Copy **`.env.example`** to **`.env`** and/or **`.env.local`**. The custom server loads `.env` then **`.env.local` with override** (see `server.ts`).
- **Never commit** `.env`, `.env.local`, or secrets. Do not paste real keys into `AGENTS.md` or code.
- **Prisma** expects **`DATABASE_URL`** in the environment (see `prisma/schema.prisma`). `.env.example` may mark it as legacy; set it for local Prisma/DB work when using this schema.
- Other domains: Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), Upstash Redis, Twilio/OpenAI Realtime and voice flags — see comments in **`.env.example`**.

## Repository layout (high level)

- **`app/`** — Next.js App Router: pages, `app/api/*` route handlers.
- **`lib/`** — Shared business logic, integrations (e.g. bot/voice, LLMs, Prisma helpers). Import alias: **`@/*`** → repo root.
- **`components/`** — Shared React components.
- **`prisma/`** — `schema.prisma`, migrations, `prisma/scripts/` SQL.
- **`supabase/migrations/`** — Supabase SQL migrations (separate from Prisma; don’t conflate the two without reading existing docs in-repo).
- **`server.ts`** — HTTP server + **WebSocket** attach for Twilio media bridge; long-lived connections (not a typical Vercel serverless model for the WS path).

**TypeScript `exclude` in `tsconfig.json`:** `scripts/`, `lib/smokey/`, `lib/wildcat/` — changes there may not be typechecked by the main project; prefer matching existing patterns if touching those areas.

## Conventions

- **TypeScript `strict` is on.**
- Prefer **small, task-focused changes**; follow existing patterns in nearby files.
- For architecture or ops details, the repo has multiple `*.md` files at the root (e.g. `DIRECTORY.md`, `SYSTEM_ARCHITECTURE.md`); use them when a change touches deployment or subsystems you don’t yet understand.

## Security

- Do not log or store secrets. Treat **service role** keys and DB URLs as highly sensitive.
- Voice/Twilio paths and admin APIs should respect existing auth and environment guards.
