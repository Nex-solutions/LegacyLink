
-- ============ MASTER WALLET ============
create table public.master_wallet (
  id boolean primary key default true check (id = true), -- singleton row
  pubkey text not null,
  encrypted_secret text not null,
  encrypted_mnemonic text not null,
  created_at timestamptz not null default now(),
  created_by uuid
);

alter table public.master_wallet enable row level security;

create policy "admin reads master wallet"
on public.master_wallet for select to authenticated
using (has_role(auth.uid(), 'admin'));

-- No insert/update/delete policies → only service role can write.

-- ============ LEDGER ACCOUNTS ============
create type public.ledger_account_type as enum ('asset','liability','equity','revenue','expense');

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type public.ledger_account_type not null,
  user_id uuid, -- nullable; set for per-user wallet accounts
  currency text not null default 'USDC',
  created_at timestamptz not null default now()
);

create index ledger_accounts_user_id_idx on public.ledger_accounts(user_id);

alter table public.ledger_accounts enable row level security;

create policy "admin reads all accounts"
on public.ledger_accounts for select to authenticated
using (has_role(auth.uid(), 'admin'));

create policy "user reads own account"
on public.ledger_accounts for select to authenticated
using (user_id = auth.uid());

-- Seed system accounts
insert into public.ledger_accounts (code, name, type) values
  ('1000','Master Hot Wallet (USDC)','asset'),
  ('2000','Fiat On-Ramp Clearing','liability'),
  ('2100','Fiat Off-Ramp Clearing','liability'),
  ('4000','Ramp Fees','expense'),
  ('5000','Adjustments','equity');

-- ============ LEDGER TRANSACTIONS ============
create type public.ledger_tx_kind as enum (
  'onramp_mint','sweep_to_master','payout_from_master','offramp_burn','fee','adjustment'
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  kind public.ledger_tx_kind not null,
  reference text,           -- vault id, claim id, etc.
  external_ref text,        -- ramp provider ref
  memo text,
  tx_signature text,        -- on-chain signature when applicable
  user_id uuid,             -- counterparty user when applicable
  created_at timestamptz not null default now(),
  created_by uuid
);

create index ledger_tx_user_idx on public.ledger_transactions(user_id);
create index ledger_tx_created_idx on public.ledger_transactions(created_at desc);

alter table public.ledger_transactions enable row level security;

create policy "admin reads all tx"
on public.ledger_transactions for select to authenticated
using (has_role(auth.uid(), 'admin'));

create policy "user reads own tx"
on public.ledger_transactions for select to authenticated
using (user_id = auth.uid());

-- ============ LEDGER ENTRIES ============
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete cascade,
  account_id uuid not null references public.ledger_accounts(id),
  side text not null check (side in ('debit','credit')),
  amount numeric(20,6) not null check (amount > 0),
  currency text not null default 'USDC',
  created_at timestamptz not null default now()
);

create index ledger_entries_tx_idx on public.ledger_entries(transaction_id);
create index ledger_entries_account_idx on public.ledger_entries(account_id);

alter table public.ledger_entries enable row level security;

create policy "admin reads all entries"
on public.ledger_entries for select to authenticated
using (has_role(auth.uid(), 'admin'));

create policy "user reads own entries"
on public.ledger_entries for select to authenticated
using (exists (
  select 1 from public.ledger_transactions t
  where t.id = ledger_entries.transaction_id and t.user_id = auth.uid()
));

-- ============ ATOMIC POSTING FUNCTION ============
create or replace function public.post_ledger_transaction(
  _kind public.ledger_tx_kind,
  _reference text,
  _external_ref text,
  _memo text,
  _tx_signature text,
  _user_id uuid,
  _entries jsonb -- array of {account_id, side, amount, currency}
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _tx_id uuid;
  _entry jsonb;
  _total_debit numeric(20,6) := 0;
  _total_credit numeric(20,6) := 0;
  _amount numeric(20,6);
  _side text;
begin
  if jsonb_array_length(_entries) < 2 then
    raise exception 'ledger transaction requires at least 2 entries';
  end if;

  -- validate balance first
  for _entry in select * from jsonb_array_elements(_entries) loop
    _amount := (_entry->>'amount')::numeric;
    _side := _entry->>'side';
    if _amount is null or _amount <= 0 then raise exception 'invalid amount'; end if;
    if _side = 'debit' then _total_debit := _total_debit + _amount;
    elsif _side = 'credit' then _total_credit := _total_credit + _amount;
    else raise exception 'invalid side: %', _side;
    end if;
  end loop;

  if _total_debit <> _total_credit then
    raise exception 'unbalanced ledger transaction: debit=% credit=%', _total_debit, _total_credit;
  end if;

  insert into public.ledger_transactions (kind, reference, external_ref, memo, tx_signature, user_id, created_by)
  values (_kind, _reference, _external_ref, _memo, _tx_signature, _user_id, auth.uid())
  returning id into _tx_id;

  for _entry in select * from jsonb_array_elements(_entries) loop
    insert into public.ledger_entries (transaction_id, account_id, side, amount, currency)
    values (
      _tx_id,
      (_entry->>'account_id')::uuid,
      _entry->>'side',
      (_entry->>'amount')::numeric,
      coalesce(_entry->>'currency','USDC')
    );
  end loop;

  return _tx_id;
end $$;

-- ============ BALANCE FUNCTION ============
create or replace function public.ledger_account_balance(_account_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(case when side='debit' then amount else -amount end), 0)
  from public.ledger_entries
  where account_id = _account_id
$$;

-- ============ ENSURE USER WALLET ACCOUNT ============
create or replace function public.ensure_user_wallet_account(_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare _id uuid;
begin
  select id into _id from public.ledger_accounts where user_id = _user_id and code like '1100-%';
  if _id is not null then return _id; end if;
  insert into public.ledger_accounts (code, name, type, user_id)
  values ('1100-' || _user_id::text, 'User Wallet ' || _user_id::text, 'asset', _user_id)
  returning id into _id;
  return _id;
end $$;
