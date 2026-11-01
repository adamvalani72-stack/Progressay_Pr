create table if not exists public.profiles (
  id text primary key references public.gaming_hub_accounts(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id, display_name)
select id, display_name
from public.gaming_hub_accounts
on conflict (id) do nothing;

create or replace function public.sync_gaming_hub_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, updated_at)
  values (new.id, new.display_name, now())
  on conflict (id) do update set
    display_name = excluded.display_name,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists gaming_hub_account_profile_sync on public.gaming_hub_accounts;
create trigger gaming_hub_account_profile_sync
after insert or update of display_name on public.gaming_hub_accounts
for each row execute function public.sync_gaming_hub_profile();

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  category text not null default 'Other',
  image_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.games (slug, name, description, category, is_featured, sort_order)
values
  ('pixel-patrol', 'Pixel Patrol', 'Take on rapid-fire missions, chase high scores, and see how long you can last.', 'Arcade', true, 10),
  ('neon-kart', 'Neon Kart', 'Discover glowing tracks, sharp turns, and fast-paced arcade racing.', 'Racing', true, 20),
  ('orbital-puzzles', 'Orbital Puzzles', 'Solve clever space-themed challenges and chain together satisfying combos.', 'Puzzle', true, 30),
  ('skyline-showdown', 'Skyline Showdown', 'Plan your moves in quick, competitive battles across a futuristic city.', 'Strategy', true, 40),
  ('redemption-run', 'Redemption Run', 'Head out on the frontier and face a dusty trail full of western action.', 'Action', true, 50)
on conflict (slug) do nothing;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  category text not null default 'Other',
  price_pence numeric(42, 0) not null check (price_pence >= 0),
  currency text not null default 'GBP' check (currency = 'GBP'),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.products (slug, name, description, category, price_pence, image_url, sort_order)
values
  ('sovereign-gaming-empire', 'The Sovereign Gaming Empire', 'Ultra-exclusive elite gaming empire package with luxury installation, private services, and full custom world-building.', 'Royal', 1199600, '/img/portfolio/07-small.jpg', 10),
  ('monarch-gaming-kingdom', 'The Monarch Gaming Kingdom', 'Full luxury gaming estate package with custom installations, elite support, and a private performance suite.', 'Founder', 879600, '/img/portfolio/06-small.jpg', 20),
  ('royal-crown-gaming-suite', 'Royal Crown Gaming Suite', 'Limited-edition luxury gaming suite with bespoke furniture, immersive sound, and private-club styling.', 'VIP', 479600, '/img/portfolio/04-small.jpg', 30),
  ('empire-of-the-titans', 'Empire of the Titans', 'Private luxury arena package with custom streaming room, elite equipment, and full concierge support.', 'VIP', 679600, '/img/portfolio/05-small.jpg', 40),
  ('cyberpunk-drift-2077', 'Cyberpunk Drift 2077', 'Neon-lit racing and open-world chaos in a futuristic city packed with missions, upgrades, and custom builds.', 'Game', 5999, '/img/portfolio/08-small.jpg', 50),
  ('apex-dominion', 'Apex Dominion', 'Drop into massive firefights, master hero abilities, and outplay rivals in fast, high-stakes competitive matches.', 'Game', 3999, '/img/portfolio/06-small.jpg', 60),
  ('forge-of-the-last-kingdom', 'Forge of the Last Kingdom', 'Build your kingdom, forge legendary gear, and lead your guild through mystical quests and massive monster battles.', 'Game', 4999, '/img/portfolio/04-small.jpg', 70),
  ('stellar-command', 'Stellar Command', 'Command fleets across a hostile galaxy, expand your empire, and outmaneuver rivals in deep-space strategy.', 'Game', 5499, '/img/portfolio/05-small.jpg', 80),
  ('apex-pro-headset', 'Apex Pro Headset', 'Engineered for high-precision gaming with noise isolation, deep bass, and crystal-clear team chat.', 'Audio', 71600, '/img/portfolio/01-small.jpg', 90),
  ('vortex-rgb-keyboard', 'Vortex RGB Keyboard', 'Hot-swappable switches, silent keycaps, and dynamic RGB lighting made for daily competitive sessions.', 'Peripherals', 59600, '/img/portfolio/02-small.jpg', 100),
  ('strike-x-mouse', 'Strike X Mouse', 'Ultra-responsive sensor, lightweight body, and ergonomic grip built to keep your aim sharp in every match.', 'Precision', 43600, '/img/portfolio/03-small.jpg', 110),
  ('titan-gaming-chair', 'Titan Gaming Chair', 'Memory foam lumbar support and premium materials designed to keep you locked in for long sessions.', 'Setup', 159600, '/img/portfolio/04-small.jpg', 120),
  ('nebula-27-monitor', 'Nebula 27" Monitor', 'High refresh-rate visuals with vivid colors and deep contrast for smooth, immersive gameplay.', 'Display', 239600, '/img/portfolio/05-small.jpg', 130),
  ('arc-wireless-controller', 'Arc Wireless Controller', 'Comfortable grip, precise control, and ultra-fast wireless response for couch co-op and competitive play.', 'Accessories', 39600, '/img/portfolio/06-small.jpg', 140),
  ('pulse-elite-earbuds', 'Pulse Elite Earbuds', 'Low-profile sound with rich detail, strong bass, and an all-day battery that keeps up with long sessions.', 'Audio', 27600, '/img/portfolio/07-small.jpg', 150),
  ('storm-51-speaker', 'Storm 5.1 Speaker', 'Room-filling sound with deep bass and crisp directional audio for cinematic gaming nights.', 'Audio', 59600, '/img/portfolio/08-small.jpg', 160),
  ('volt-x-desk-mat', 'Volt X Desk Mat', 'Extra-large soft-touch mat with anti-slip grip and cable channels for a cleaner battle station.', 'Furniture', 23600, '/img/portfolio/09-small.jpg', 170),
  ('titanium-battle-station', 'Titanium Battle Station', 'Luxury gaming desk with integrated cable management, premium finish, and racing-inspired ergonomics.', 'Furniture', 1039600, '/img/portfolio/01-small.jpg', 180),
  ('apex-prestige-setup', 'Apex Prestige Setup', 'Custom luxury bundle with signature mechanical keyboard, premium chair, and high-end audio essentials.', 'Peripherals', 1799600, '/img/portfolio/02-small.jpg', 190),
  ('galactic-summon-rig', 'Galactic Summon Rig', 'High-end tournament-grade setup handcrafted for players who want the absolute finest performance and style.', 'Setup', 2399600, '/img/portfolio/03-small.jpg', 200),
  ('cloudstrike-wireless-controller', 'CloudStrike Wireless Controller', 'Low-latency wireless controls, ergonomic grip, and trigger customization made for fast reactions and all-night sessions.', 'Accessories', 51600, '/img/portfolio/08-small.jpg', 210),
  ('gaming-hub-gift-card', 'Gaming Hub Gift Card', 'Give premium access to elite gear, exclusive drops, and premium support with a flexible digital gift card.', 'Digital', 25000, '/img/portfolio/08-small.jpg', 220),
  ('galactic-gift-card', 'Galactic Gift Card', 'The perfect luxury gift for gaming lovers, designed for premium bundles, rare gear, and exclusive upgrades.', 'Elite', 50000, '/img/portfolio/07-small.jpg', 230),
  ('royal-prestige-gift-card', 'Royal Prestige Gift Card', 'Ideal for premium gifting, giving access to luxury builds, special editions, and elite collection drops.', 'Royal', 100000, '/img/portfolio/05-small.jpg', 240),
  ('10000-gift-card', '£10,000 Gift Card', 'Ultra-premium gifting for collectors, studios, and buyers seeking monumental access to elite gaming experiences.', 'Legendary', 1000000, '/img/Neon Gaming Hub £10,000 Gift Card.png', 250),
  ('100000-gift-card', '£100,000 Gift Card', 'For private clients, luxury collectors, and prestige gifting at the highest level of gaming luxury.', 'Imperial', 10000000, '/img/gaming-hub-100k-gift-card.webp', 260),
  ('cosmic-gift-card', '£1,000,000,000,000,000,000,000,000,000,000,000 Gift Card', 'For the rarest ultra-elite collectors seeking the ultimate statement in luxury gaming access and world-class prestige.', 'Cosmic', 100000000000000000000000000000000000000, '/img/Neon Gaming Hub Gift Card.png', 270),
  ('galactic-gaming-setup', 'Galactic Gaming Setup', 'Premium space-age battle station with cinematic lighting, elite audio, and a custom luxury rig built for maximum immersion.', 'Setup', 1519600, '/img/galactic-gaming-hub-setup.png', 280)
on conflict (slug) do nothing;

create table if not exists public.subscription_plans (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  price_pence bigint not null check (price_pence >= 0),
  billing_interval text not null default 'year' check (billing_interval in ('year')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (id, name, price_pence, sort_order)
values
  ('free', 'Free', 0, 0),
  ('basic', 'Basic', 199, 10),
  ('standard', 'Standard', 999, 20),
  ('premium', 'Premium', 1999, 30),
  ('vip', 'VIP', 29999, 40),
  ('galactic', 'Galactic', 49999, 50),
  ('galactic-plus', 'Galactic Plus', 79999, 60),
  ('galactic-plus-plus', 'Galactic Plus Plus', 99999, 70),
  ('ultimate', 'Ultimate', 199999, 80),
  ('ultimate-pro', 'Ultimate Pro', 1999999, 90),
  ('ultimate-elite', 'Ultimate Elite', 2100000, 100),
  ('ultimate-peak', 'Ultimate Peak', 2500000, 110)
on conflict (id) do nothing;

alter table public.orders
  add column if not exists account_id text references public.gaming_hub_accounts(id) on delete set null;

alter table public.memberships
  add column if not exists account_id text references public.gaming_hub_accounts(id) on delete set null;

create index if not exists orders_account_created_idx
  on public.orders (account_id, created_at desc);
create index if not exists memberships_account_created_idx
  on public.memberships (account_id, created_at desc);
create index if not exists games_active_sort_idx
  on public.games (sort_order, name) where is_active;
create index if not exists products_active_sort_idx
  on public.products (sort_order, name) where is_active;

create or replace view public.subscriptions
with (security_invoker = true)
as
select id, stripe_subscription_id, stripe_customer_id, account_id, plan_id,
       customer_email, status, current_period_end, created_at
from public.memberships;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.products enable row level security;
alter table public.subscription_plans enable row level security;

revoke all on table public.profiles, public.games, public.products,
  public.subscription_plans, public.subscriptions
from public, anon, authenticated;

grant select, update on table public.profiles to service_role;
grant select, insert, update, delete on table public.games to service_role;
grant select, insert, update, delete on table public.products to service_role;
grant select, insert, update, delete on table public.subscription_plans to service_role;
grant select on table public.subscriptions to service_role;
grant select, insert, update on table public.orders to service_role;
grant select, insert, update on table public.memberships to service_role;
