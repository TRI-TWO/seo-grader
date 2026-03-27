-- Unblocks Prisma db push (P4002): removes FK from public.audits → auth.users
ALTER TABLE public.audits DROP CONSTRAINT IF EXISTS audits_requested_by_user_id_fkey;
