-- ====================================================
-- REVIEWLENS: SUPABASE DATABASE SCHEMAS
-- ====================================================

-- 1. Profiles Table (linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  email text,
  avatar_url text,
  age integer,
  skin_type text default 'normal',
  max_budget numeric default 1500,
  preferred_categories text[] default '{}'::text[],
  viewed_products integer[] default '{}'::integer[],
  recommendation_history jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default now()
);

-- Enable Row-Level Security (RLS) on Profiles
alter table public.profiles enable row level security;

-- Drop existing policies if any to prevent conflicts
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- 2. Watchlists Table (linked to auth.users)
create table if not exists public.watchlists (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  product_id integer not null,
  product_name text,
  category text,
  price numeric,
  image_url text,
  target_price numeric,
  added_at timestamp with time zone default now(),
  unique (user_id, product_id)
);

-- Enable Row-Level Security (RLS) on Watchlists
alter table public.watchlists enable row level security;

-- Drop existing policies if any to prevent conflicts
drop policy if exists "Users can view their own watchlist" on public.watchlists;
drop policy if exists "Users can insert their own watchlist" on public.watchlists;
drop policy if exists "Users can delete their own watchlist" on public.watchlists;
drop policy if exists "Users can update their own watchlist" on public.watchlists;

create policy "Users can view their own watchlist" on public.watchlists
  for select using (auth.uid() = user_id);

create policy "Users can insert their own watchlist" on public.watchlists
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their own watchlist" on public.watchlists
  for delete using (auth.uid() = user_id);

create policy "Users can update their own watchlist" on public.watchlists
  for update using (auth.uid() = user_id);

-- 3. Automatic Profile Creation Trigger on Sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, email, avatar_url, age, skin_type, max_budget, preferred_categories)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || new.id),
    25,
    'normal',
    1500,
    '{"Skincare & Beauty", "Electronics"}'::text[]
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution setup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
