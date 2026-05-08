
-- Add search_path to trigger functions
create or replace function public.set_updated_at()
returns trigger language plpgsql
security definer set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'family');
  return new;
end $$;

-- Revoke direct EXECUTE; these are only meant for triggers / RLS policy evaluation
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
