-- Extend invite lifecycle for Admin CRM (sending / failed + last error)

alter table public.client_portal_registrations
  add column if not exists invite_last_error text;

alter table public.client_portal_registrations
  drop constraint if exists client_portal_registrations_invite_status_check;

alter table public.client_portal_registrations
  add constraint client_portal_registrations_invite_status_check
  check (invite_status in ('pending', 'sending', 'sent', 'failed', 'accepted', 'inactive'));
