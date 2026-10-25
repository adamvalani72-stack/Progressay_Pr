create table if not exists public.gaming_hub_accounts (
  id text primary key,
  email text not null unique check (email = lower(email) and char_length(email) <= 254),
  display_name text not null check (char_length(display_name) between 1 and 80),
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  role text not null default 'member' check (role in ('member', 'owner'))
);

alter table public.gaming_hub_accounts
  add column if not exists role text not null default 'member' check (role in ('member', 'owner'));

update public.gaming_hub_accounts
set role = 'owner'
where lower(email) = 'adamvalani72@gmail.com';

create table if not exists public.gaming_hub_game_progress (
  user_id text not null references public.gaming_hub_accounts(id) on delete cascade,
  game_key text not null check (game_key in (
    'pixel-patrol', 'neon-kart', 'orbital-puzzles', 'skyline-showdown', 'redemption-run'
  )),
  best_score integer not null check (best_score between 0 and 10000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_key)
);

create table if not exists public.gaming_hub_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id text not null references public.gaming_hub_accounts(id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists gaming_hub_sessions_expiry_idx
  on public.gaming_hub_sessions (expires_at);

alter table public.gaming_hub_accounts enable row level security;
alter table public.gaming_hub_game_progress enable row level security;
alter table public.gaming_hub_sessions enable row level security;

revoke all on table public.gaming_hub_accounts,
  public.gaming_hub_game_progress,
  public.gaming_hub_sessions from public, anon, authenticated;
grant select, insert on table public.gaming_hub_accounts to service_role;
grant select on table public.gaming_hub_game_progress to service_role;
grant select, insert, delete on table public.gaming_hub_sessions to service_role;

create or replace function public.save_gaming_hub_game_progress(
  p_user_id text,
  p_game_key text,
  p_score integer
)
returns table (best_score integer, updated_at timestamptz, personal_best boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous_best integer;
  saved_best integer;
  saved_at timestamptz;
begin
  if p_game_key not in (
    'pixel-patrol', 'neon-kart', 'orbital-puzzles', 'skyline-showdown', 'redemption-run'
  ) or p_score < 0 or p_score > 10000000 then
    raise exception 'Invalid game progress';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':' || p_game_key, 0));

  select progress.best_score into previous_best
  from public.gaming_hub_game_progress as progress
  where progress.user_id = p_user_id and progress.game_key = p_game_key;

  insert into public.gaming_hub_game_progress as stored (user_id, game_key, best_score)
  values (p_user_id, p_game_key, p_score)
  on conflict (user_id, game_key) do update set
    best_score = greatest(stored.best_score, excluded.best_score),
    updated_at = case
      when excluded.best_score > stored.best_score then now()
      else stored.updated_at
    end
  returning stored.best_score, stored.updated_at into saved_best, saved_at;

  return query select saved_best, saved_at, p_score > coalesce(previous_best, -1);
end;
$$;

revoke all on function public.save_gaming_hub_game_progress(text, text, integer) from public;
revoke all on function public.save_gaming_hub_game_progress(text, text, integer) from anon, authenticated;
grant execute on function public.save_gaming_hub_game_progress(text, text, integer) to service_role;