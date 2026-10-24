-- Ug Life online backend (Supabase / Postgres). Not live yet: apply this when
-- accounts are switched on. The rules mirror src/game/ledger.ts and actions.ts.
-- The browser never writes balances directly; it calls these functions.

create table if not exists players (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 20),
  status text not null default '' check (char_length(status) <= 60),
  look jsonb not null default '{}'::jsonb,
  ghost boolean not null default false,
  age_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  frozen boolean not null default false -- set by the economy watchdog, reversible by a human
);

create table if not exists player_socials (
  player_id uuid references players (id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram', 'x', 'youtube', 'facebook')),
  handle text not null check (handle ~ '^[A-Za-z0-9_.-]{1,50}$'),
  verified_at timestamptz, -- only set after the player signs in to that platform
  primary key (player_id, platform)
);

-- Append-only money ledger. (player_id, key) is unique, so a retried request can never pay twice.
create table if not exists ledger_entries (
  id bigserial primary key,
  player_id uuid not null references players (id) on delete cascade,
  key text not null,
  amount integer not null check (amount <> 0),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (player_id, key)
);
create index if not exists ledger_player_idx on ledger_entries (player_id, created_at desc);

create table if not exists kiosks (
  plot_id text primary key,
  player_id uuid not null unique references players (id) on delete cascade,
  name text not null,
  color text not null,
  product text not null,
  upgrades text[] not null default '{}',
  leased_at timestamptz not null,
  leased_until timestamptz not null
);

create table if not exists tickets (
  id bigserial primary key,
  player_id uuid references players (id) on delete set null,
  category text not null check (category in ('how-to', 'bug', 'account', 'safety', 'other')),
  body text not null check (char_length(body) between 5 and 1000),
  priority text not null default 'P2' check (priority in ('P0', 'P1', 'P2')),
  status text not null default 'open' check (status in ('open', 'answered', 'escalated', 'closed')),
  agent_reply text,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id bigserial primary key,
  reporter_id uuid references players (id) on delete set null,
  target_player_id uuid references players (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  reviewed_by text, -- 'moderation-agent' suggests, a human decides
  decision text
);

-- ---------- money: the only way balances change ----------

create or replace function balance_of(p uuid) returns integer
language sql stable as $$ select coalesce(sum(amount), 0)::integer from ledger_entries where player_id = p $$;

create or replace function post_ledger(p_key text, p_amount integer, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  bal integer;
begin
  if me is null then raise exception 'not signed in'; end if;
  if (select frozen from players where id = me) then raise exception 'account under review'; end if;
  perform pg_advisory_xact_lock(hashtext(me::text)); -- one money change per player at a time
  if exists (select 1 from ledger_entries where player_id = me and key = p_key) then
    raise exception 'duplicate';
  end if;
  bal := balance_of(me);
  if bal + p_amount < 0 then raise exception 'insufficient'; end if;
  insert into ledger_entries (player_id, key, amount, reason) values (me, p_key, p_amount, p_reason);
  return bal + p_amount;
end $$;

-- post_ledger is called from server-side game functions (Cloudflare Worker with the
-- service role) that check the game rules first: job pay limits, 10 jobs a day,
-- kiosk sale caps. It is not granted to the browser directly.
revoke all on function post_ledger(text, integer, text) from public, anon, authenticated;

-- ---------- row level security ----------

alter table players enable row level security;
alter table player_socials enable row level security;
alter table ledger_entries enable row level security;
alter table kiosks enable row level security;
alter table tickets enable row level security;
alter table reports enable row level security;

create policy players_read on players for select using (true);
create policy players_update_self on players for update using (id = auth.uid()) with check (id = auth.uid() and frozen = false);
create policy socials_read on player_socials for select using (true);
create policy socials_write_self on player_socials for all using (player_id = auth.uid()) with check (player_id = auth.uid() and verified_at is null);
create policy ledger_read_self on ledger_entries for select using (player_id = auth.uid());
create policy kiosks_read on kiosks for select using (true);
create policy tickets_insert_self on tickets for insert with check (player_id = auth.uid());
create policy tickets_read_self on tickets for select using (player_id = auth.uid());
create policy reports_insert_self on reports for insert with check (reporter_id = auth.uid());
