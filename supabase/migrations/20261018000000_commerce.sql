create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  stripe_customer_id text,
  customer_email text not null,
  amount_total bigint not null check (amount_total >= 0),
  currency text not null,
  status text not null,
  items jsonb not null default '[]'::jsonb,
  shipping_details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  stripe_subscription_id text not null unique,
  stripe_customer_id text,
  plan_id text not null,
  customer_email text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  last_four text not null check (last_four ~ '^[A-Z0-9]{4}$'),
  initial_balance_pence bigint not null check (initial_balance_pence >= 0),
  balance_pence bigint not null check (balance_pence >= 0 and balance_pence <= initial_balance_pence),
  status text not null default 'active' check (status in ('active', 'disabled', 'redeemed')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) <= 254),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  rating smallint not null check (rating between 1 and 5),
  review text not null check (char_length(review) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reviews_publication_idx
  on public.reviews (created_at desc)
  where status = 'approved';

alter table public.orders enable row level security;
alter table public.memberships enable row level security;
alter table public.gift_cards enable row level security;
alter table public.contact_messages enable row level security;
alter table public.reviews enable row level security;
