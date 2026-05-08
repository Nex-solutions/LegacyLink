-- ────────────────────────────────────────────────────────────────────
-- 1. Enum tweak
-- ────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'released' and enumtypid = 'public.vault_status'::regtype) then
    alter type public.vault_status add value 'released';
  end if;
exception when others then null;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 2. Custodial wallets
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.custodial_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pubkey text not null unique,
  encrypted_secret text not null,            -- base64(iv || ciphertext)
  created_at timestamptz not null default now()
);

alter table public.custodial_wallets enable row level security;

drop policy if exists "owner reads pubkey" on public.custodial_wallets;
create policy "owner reads pubkey"
  on public.custodial_wallets
  for select
  to authenticated
  using (auth.uid() = user_id);

-- writes are service-role only (no INSERT/UPDATE/DELETE policies).

-- ────────────────────────────────────────────────────────────────────
-- 3. Vault + beneficiary columns
-- ────────────────────────────────────────────────────────────────────
alter table public.vaults
  add column if not exists vault_pda text,
  add column if not exists usdc_ata text,
  add column if not exists init_tx text,
  add column if not exists letter_message text;

alter table public.beneficiaries
  add column if not exists wallet_pubkey text,
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_token text;

create index if not exists beneficiaries_claim_token_idx
  on public.beneficiaries (claim_token);

-- ────────────────────────────────────────────────────────────────────
-- 4. assign_advisor_role: lets a fresh signup mark themselves as advisor
--    SECURITY DEFINER — bypasses the read-only RLS on user_roles.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.assign_advisor_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Remove the default 'family' row if present, then insert advisor.
  delete from public.user_roles
   where user_id = auth.uid() and role = 'family';

  insert into public.user_roles (user_id, role)
  values (auth.uid(), 'advisor')
  on conflict do nothing;
end $$;

revoke all on function public.assign_advisor_role() from public;
grant execute on function public.assign_advisor_role() to authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 5. consume_claim_token: validates magic-link token, marks claimed.
--    SECURITY DEFINER so a beneficiary that isn't the vault owner can
--    still update their row.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.consume_claim_token(
  _vault_id uuid,
  _token text,
  _payout_signature text
)
returns table (
  beneficiary_id uuid,
  vault_name text,
  pct numeric,
  amount_cad numeric,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.beneficiaries%rowtype;
  _vault public.vaults%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into _vault from public.vaults where id = _vault_id;
  if not found then raise exception 'vault not found'; end if;
  if _vault.status <> 'released' then raise exception 'vault not released'; end if;

  select * into _row
    from public.beneficiaries
   where vault_id = _vault_id
     and claim_token = _token
   limit 1;
  if not found then raise exception 'invalid claim token'; end if;
  if _row.claimed_at is not null then raise exception 'already claimed'; end if;

  update public.beneficiaries
     set claimed_at = now(),
         payout_tx_signature = _payout_signature
   where id = _row.id;

  insert into public.vault_events (vault_id, actor_id, kind, detail, tx_signature)
  values (_vault_id, auth.uid(), 'release', 'Beneficiary claim: ' || _row.email, _payout_signature);

  return query
    select _row.id, _vault.name, _row.pct, _vault.amount_cad * _row.pct / 100, _row.email;
end $$;

revoke all on function public.consume_claim_token(uuid, text, text) from public;
grant execute on function public.consume_claim_token(uuid, text, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 6. Demo seed RPC
-- ────────────────────────────────────────────────────────────────────
create or replace function public.seed_demo_for_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _v1 uuid; _v2 uuid; _v3 uuid; _v4 uuid;
begin
  if _uid is null then raise exception 'not authenticated'; end if;

  delete from public.vaults where owner_id = _uid;

  insert into public.vaults (owner_id, name, amount_cad, status, condition_kind, unlock_date)
    values (_uid, 'Family Trust Alpha', 12000, 'pending', 'time', (current_date + interval '12 days')::date)
    returning id into _v1;
  insert into public.beneficiaries (vault_id, name, email, pct) values
    (_v1, 'Amara Okafor', 'amara@email.com', 60),
    (_v1, 'Tobias Okafor', 'tobias@email.com', 40);

  insert into public.vaults (owner_id, name, amount_cad, status, condition_kind, inactivity_days, last_checkin)
    values (_uid, 'Kids Education Fund', 6200, 'pending', 'inactivity', 180, now() - interval '175 days')
    returning id into _v2;
  insert into public.beneficiaries (vault_id, name, email, pct) values
    (_v2, 'Amara Okafor', 'amara@email.com', 100);

  insert into public.vaults (owner_id, name, amount_cad, status, condition_kind)
    values (_uid, 'Emergency Reserve', 2500, 'pending', 'manual')
    returning id into _v3;
  insert into public.beneficiaries (vault_id, name, email, pct) values
    (_v3, 'Ngozi Okafor', 'ngozi@email.com', 50),
    (_v3, 'Emeka Oriaku', 'emeka@email.com', 30),
    (_v3, 'Tobias Okafor', 'tobias@email.com', 20);

  insert into public.vaults (owner_id, name, amount_cad, status, condition_kind)
    values (_uid, 'Wedding Gift for Ada', 4500, 'released', 'manual')
    returning id into _v4;
  insert into public.beneficiaries (vault_id, name, email, pct, claim_token) values
    (_v4, 'Ada Okafor', 'ada@email.com', 100, 'demo-token-ada');

  insert into public.vault_events (vault_id, actor_id, kind, detail) values
    (_v1, _uid, 'fund', 'Vault funded · CA$12,000'),
    (_v2, _uid, 'checkin', 'Owner checked in 175 days ago'),
    (_v3, _uid, 'fund', 'Vault funded · CA$2,500'),
    (_v4, _uid, 'release', 'Manually released by owner');
end $$;

revoke all on function public.seed_demo_for_user() from public;
grant execute on function public.seed_demo_for_user() to authenticated;