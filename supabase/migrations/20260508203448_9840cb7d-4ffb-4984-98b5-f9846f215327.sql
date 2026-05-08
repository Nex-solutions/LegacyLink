
-- Ramp kind enum
do $$ begin
  create type public.ramp_kind as enum ('onramp', 'offramp');
exception when duplicate_object then null; end $$;

-- ramp_intents table
create table if not exists public.ramp_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  kind public.ramp_kind not null,
  status text not null default 'created',
  paytrie_tx_id text unique,
  paytrie_rmt text,
  deposit_address text,
  destination_wallet text,
  quote_id bigint,
  amount_cad numeric(20,2),
  amount_usdc numeric(20,6),
  fee_cad numeric(20,2),
  sweep_tx_signature text,
  payout_tx_signature text,
  ledger_tx_id uuid,
  beneficiary_email text,
  reference text,
  last_webhook jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ramp_intents_user_idx on public.ramp_intents(user_id);
create index if not exists ramp_intents_status_idx on public.ramp_intents(status);

alter table public.ramp_intents enable row level security;

drop policy if exists "user reads own ramp" on public.ramp_intents;
create policy "user reads own ramp"
  on public.ramp_intents for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "admin reads all ramps" on public.ramp_intents;
create policy "admin reads all ramps"
  on public.ramp_intents for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger ramp_intents_updated_at
  before update on public.ramp_intents
  for each row execute function public.set_updated_at();

-- Gas expense account
insert into public.ledger_accounts (code, name, type, currency)
values ('5000', 'Network Fees (Gas)', 'expense', 'SOL')
on conflict (code) do nothing;
