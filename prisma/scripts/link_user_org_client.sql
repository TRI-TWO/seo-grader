-- Link a Supabase Auth user to the Arch client portal.
-- Run in Supabase SQL Editor, or after editing: npm run db:link-arch-user
--
-- 1) Find the user id:
--    SELECT id, email FROM auth.users WHERE email ILIKE '%mjhanratty18%';
--
-- 2) Replace the placeholder below with that UUID.

DO $$
DECLARE
  auth_user_id_text text := 'REPLACE_WITH_AUTH_USERS_ID';
  auth_user_id uuid;
  new_org_id uuid := gen_random_uuid();
  new_client_id uuid := gen_random_uuid();
BEGIN
  IF auth_user_id_text = 'REPLACE_WITH_AUTH_USERS_ID' THEN
    RAISE EXCEPTION 'Edit auth_user_id_text: set it to the UUID from auth.users (see script header).';
  END IF;

  auth_user_id := auth_user_id_text::uuid;

  INSERT INTO public.organizations (id, name, created_at, updated_at)
  VALUES (new_org_id, 'Local dev organization', now(), now());

  INSERT INTO public.org_members (org_id, user_id, role, created_at)
  VALUES (new_org_id, auth_user_id, 'owner', now());

  INSERT INTO public.clients (id, org_id, name, created_at, updated_at)
  VALUES (new_client_id, new_org_id, 'Local dev client', now(), now());

  INSERT INTO public.sites (id, client_id, canonical_url, created_at, updated_at)
  VALUES (gen_random_uuid(), new_client_id, 'https://example.com', now(), now());
END $$;
