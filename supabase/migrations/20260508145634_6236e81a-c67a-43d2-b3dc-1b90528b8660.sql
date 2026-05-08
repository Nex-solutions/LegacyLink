
-- 1. Move encrypted_secret out of custodial_wallets so authenticated SELECT can never reach it.
create table if not exists public.custodial_wallet_secrets (
  user_id uuid primary key,
  encrypted_secret text not null,
  created_at timestamptz not null default now()
);
alter table public.custodial_wallet_secrets enable row level security;
-- No policies => only service-role (server admin client) can read/write.

insert into public.custodial_wallet_secrets (user_id, encrypted_secret, created_at)
select user_id, encrypted_secret, created_at from public.custodial_wallets
on conflict (user_id) do nothing;

alter table public.custodial_wallets drop column encrypted_secret;

-- 2. Restrict advisor_clients INSERT/manage to users with advisor role.
drop policy if exists "advisor manages own links" on public.advisor_clients;
create policy "advisor manages own links"
on public.advisor_clients
for all
to authenticated
using (auth.uid() = advisor_id and public.has_role(auth.uid(), 'advisor'))
with check (auth.uid() = advisor_id and public.has_role(auth.uid(), 'advisor'));

-- 3. Hide claim_token from advisors. Drop the broad advisor SELECT, recreate
--    via column-level grant pattern: revoke SELECT on claim_token for
--    authenticated, then re-grant SELECT on the rest of the columns.
revoke select on public.beneficiaries from authenticated;
grant select (id, vault_id, name, email, pct, payout_tx_signature, claimed_at, wallet_pubkey, created_at)
  on public.beneficiaries to authenticated;
-- Owners still need claim_token to share with beneficiaries; service role
-- (server admin) reads it for the consume_claim_token RPC. Add a column-level
-- grant ONLY for the owner via a SECURITY DEFINER helper used by server fns.
-- For now we keep claim_token reachable only via the RPC + service role.
grant select (claim_token) on public.beneficiaries to service_role;
