-- 1. Add 'individual' to app_role enum (keep 'family' as deprecated)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'individual';

-- 2. Add KYC fields to profiles for Paytrie onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS address1 text,
  ADD COLUMN IF NOT EXISTS address2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS pep boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tpd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS paytrie_verification_link text,
  ADD COLUMN IF NOT EXISTS paytrie_user_id text,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz;

-- 3. New signups get 'individual'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'individual');
  return new;
end $$;

-- 4. Become-advisor helper handles both legacy and new role names
CREATE OR REPLACE FUNCTION public.assign_advisor_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.user_roles
   where user_id = auth.uid() and role in ('family','individual');
  insert into public.user_roles (user_id, role)
  values (auth.uid(), 'advisor')
  on conflict do nothing;
end $$;