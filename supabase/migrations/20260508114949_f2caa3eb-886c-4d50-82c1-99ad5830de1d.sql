
-- Roles enum + table (separate from profiles to avoid privilege escalation)
create type public.app_role as enum ('admin', 'advisor', 'family');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  solana_wallet text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- has_role security-definer to avoid recursive RLS
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Vaults
create type public.vault_status as enum ('pending', 'active', 'released', 'cancelled');
create type public.condition_kind as enum ('time', 'inactivity', 'manual');

create table public.vaults (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount_cad numeric(14,2) not null default 0,
  status public.vault_status not null default 'pending',
  condition_kind public.condition_kind not null default 'manual',
  unlock_date date,
  inactivity_days int,
  last_checkin timestamptz,
  -- Blockchain-ready fields (Solana program account)
  solana_pubkey text,        -- vault PDA address
  tx_signature text,         -- creation tx
  chain text default 'solana',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.vaults (owner_id);

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  name text not null,
  email text not null,
  pct numeric(5,2) not null check (pct >= 0 and pct <= 100),
  payout_tx_signature text,
  created_at timestamptz not null default now()
);
create index on public.beneficiaries (vault_id);

create type public.event_kind as enum ('fund','checkin','release','warning','beneficiary','condition_update');

create table public.vault_events (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind public.event_kind not null,
  detail text,
  tx_signature text,
  created_at timestamptz not null default now()
);
create index on public.vault_events (vault_id);

create table public.advisor_clients (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (advisor_id, client_id)
);
create index on public.advisor_clients (advisor_id);
create index on public.advisor_clients (client_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger trg_vaults_updated before update on public.vaults
  for each row execute procedure public.set_updated_at();

-- Auto-create profile + family role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'family');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.vaults enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.vault_events enable row level security;
alter table public.advisor_clients enable row level security;

-- Profiles
create policy "own profile read" on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "advisor reads linked client profile" on public.profiles for select to authenticated
  using (exists (select 1 from public.advisor_clients ac
                 where ac.advisor_id = auth.uid() and ac.client_id = profiles.id));
create policy "own profile update" on public.profiles for update to authenticated
  using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- user_roles (read-only for the user; admins manage via service role)
create policy "read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

-- Vaults
create policy "owner all vaults" on public.vaults for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "advisor reads linked vaults" on public.vaults for select to authenticated
  using (exists (select 1 from public.advisor_clients ac
                 where ac.advisor_id = auth.uid() and ac.client_id = vaults.owner_id));

-- Beneficiaries
create policy "owner manages beneficiaries" on public.beneficiaries for all to authenticated
  using (exists (select 1 from public.vaults v where v.id = vault_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.vaults v where v.id = vault_id and v.owner_id = auth.uid()));
create policy "advisor reads linked beneficiaries" on public.beneficiaries for select to authenticated
  using (exists (select 1 from public.vaults v
                 join public.advisor_clients ac on ac.client_id = v.owner_id
                 where v.id = vault_id and ac.advisor_id = auth.uid()));

-- Vault events
create policy "owner reads events" on public.vault_events for select to authenticated
  using (exists (select 1 from public.vaults v where v.id = vault_id and v.owner_id = auth.uid()));
create policy "owner inserts events" on public.vault_events for insert to authenticated
  with check (exists (select 1 from public.vaults v where v.id = vault_id and v.owner_id = auth.uid()));
create policy "advisor reads linked events" on public.vault_events for select to authenticated
  using (exists (select 1 from public.vaults v
                 join public.advisor_clients ac on ac.client_id = v.owner_id
                 where v.id = vault_id and ac.advisor_id = auth.uid()));

-- Advisor clients
create policy "advisor reads own links" on public.advisor_clients for select to authenticated
  using (auth.uid() = advisor_id or auth.uid() = client_id);
create policy "advisor manages own links" on public.advisor_clients for all to authenticated
  using (auth.uid() = advisor_id) with check (auth.uid() = advisor_id);
