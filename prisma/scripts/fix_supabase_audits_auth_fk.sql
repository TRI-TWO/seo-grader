-- Option A (easiest): from repo root, with DATABASE_URL in .env:
--   npm run db:fix-audits-fk
-- Then: npm run db:push

-- Option B: run the one-liner below in Supabase SQL Editor.
-- See also: drop_audits_auth_fk.sql (same statement).

ALTER TABLE public.audits DROP CONSTRAINT IF EXISTS audits_requested_by_user_id_fkey;

-- Option C: if Option A/B say the constraint doesn't exist but Prisma still errors,
-- run the DO block below in SQL Editor to drop ANY public.audits FK into schema auth.

/*
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname AS fk_name
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace rel_ns ON rel_ns.oid = rel.relnamespace
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    WHERE c.contype = 'f'
      AND rel_ns.nspname = 'public'
      AND rel.relname = 'audits'
      AND ref_ns.nspname = 'auth'
  LOOP
    EXECUTE format('ALTER TABLE public.audits DROP CONSTRAINT %I', r.fk_name);
    RAISE NOTICE 'Dropped constraint: %', r.fk_name;
  END LOOP;
END $$;
*/
