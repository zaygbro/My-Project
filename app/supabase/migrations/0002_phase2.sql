-- Francisity Phase 2: structured site content, version history/rollback,
-- and per-site analytics events. Run after 0001_init.sql.

-- Sites gain structured content: an array of {key, title, body} sections
-- that a section-level rebuild can target individually.
alter table public.sites
  add column if not exists content jsonb not null default '[]'::jsonb;

-- Superseded by counting real site_versions rows for the current month —
-- a running counter would need its own monthly-reset logic to do the same
-- thing less accurately.
alter table public.sites
  drop column if exists rebuild_count;

-- Every edit (or rollback) writes a full snapshot here, so "rebuild this
-- section" and "roll back to a prior version" both have something real to
-- act on instead of just overwriting `sites.content` in place.
create table if not exists public.site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  content jsonb not null,
  changed_sections text[] not null default '{}',
  -- 'create' seeds a site's first version; 'edit' is a real content change
  -- and counts against the plan's monthly rebuild limit; 'rollback'
  -- restores a prior version and does not.
  kind text not null default 'edit' check (kind in ('create', 'edit', 'rollback')),
  created_at timestamptz not null default now()
);

-- One row per view of a published site. Nothing writes here yet because
-- there's no real hosting pipeline serving published sites — this table
-- (and /api/track) is the real, working mechanism a published site's page
-- will call, not a placeholder. Until that exists, dashboards read this as
-- a true, honest zero rather than a fabricated number.
create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  event_type text not null default 'view' check (event_type in ('view')),
  path text,
  referrer text,
  occurred_at timestamptz not null default now()
);

create index if not exists site_versions_site_id_created_at_idx
  on public.site_versions (site_id, created_at desc);
create index if not exists site_events_site_id_occurred_at_idx
  on public.site_events (site_id, occurred_at desc);

alter table public.site_versions enable row level security;
alter table public.site_events enable row level security;

-- Version history is readable by the owning user; writes go through
-- server actions using the user's own session (RLS still applies there),
-- so "insert own" mirrors the sites policy via a join on site ownership.
create policy "site_versions: read own" on public.site_versions
  for select using (
    exists (
      select 1 from public.sites
      where sites.id = site_versions.site_id and sites.user_id = auth.uid()
    )
  );

create policy "site_versions: insert own" on public.site_versions
  for insert with check (
    exists (
      select 1 from public.sites
      where sites.id = site_versions.site_id and sites.user_id = auth.uid()
    )
  );

-- Analytics are readable by the owning user. There is deliberately no
-- insert policy for the anon/authenticated roles: /api/track writes
-- through the service-role client after validating the site exists, so a
-- visitor's browser never needs (or gets) direct table access.
create policy "site_events: read own" on public.site_events
  for select using (
    exists (
      select 1 from public.sites
      where sites.id = site_events.site_id and sites.user_id = auth.uid()
    )
  );
