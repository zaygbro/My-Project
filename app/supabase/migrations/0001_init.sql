-- Francisity: accounts, subscriptions, and sites
-- Run this against your Supabase project (SQL Editor, or `supabase db push`).

create extension if not exists "pgcrypto";

-- One row per authenticated user, mirroring auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- Current plan/billing state per user. Created with the 'spark' (free) plan
-- by default; Stripe webhooks are the only writer after that.
create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'spark' check (plan in ('spark', 'pro', 'studio')),
  billing_period text check (billing_period in ('monthly', 'annual')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'active'
    check (status in (
      'active', 'trialing', 'past_due', 'canceled',
      'incomplete', 'incomplete_expired', 'unpaid', 'paused'
    )),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- One row per site a user has created.
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  brief text,
  subdomain text unique,
  custom_domain text,
  badge_enabled boolean not null default true,
  rebuild_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.sites enable row level security;

-- Users can read their own profile/subscription; only the service role
-- (Stripe webhook, using the service key) can write subscriptions.
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

create policy "subscriptions: read own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Users can fully manage their own sites, but never bypass the plan's
-- site limit or clear their own badge — that enforcement lives in the
-- dashboard server action, not in SQL, since it needs the user's current
-- plan to decide the limit.
create policy "sites: read own" on public.sites
  for select using (auth.uid() = user_id);

create policy "sites: insert own" on public.sites
  for insert with check (auth.uid() = user_id);

create policy "sites: update own" on public.sites
  for update using (auth.uid() = user_id);

create policy "sites: delete own" on public.sites
  for delete using (auth.uid() = user_id);

-- Create a profile + default (spark) subscription row whenever someone
-- signs up through Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
