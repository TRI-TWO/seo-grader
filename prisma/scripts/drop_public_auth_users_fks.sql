-- Unblocks Prisma `db push` against Supabase.
-- Supabase often has public tables with FKs into auth.users (schema auth).
-- Prisma introspection fails with P4002 unless multiSchema is enabled (unsafe here).
-- This script drops *only* the FK constraints from schema public -> schema auth.
-- It does NOT drop tables, columns, or data.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      rel.relname  AS table_name,
      c.conname    AS fk_name
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace rel_ns ON rel_ns.oid = rel.relnamespace
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    WHERE c.contype = 'f'
      AND rel_ns.nspname = 'public'
      AND ref_ns.nspname = 'auth'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.fk_name);
    RAISE NOTICE 'Dropped FK %.%: %', 'public', r.table_name, r.fk_name;
  END LOOP;
END $$;

