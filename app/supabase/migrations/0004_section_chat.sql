-- Francisity: per-section chat history, so AI-assisted editing is a real
-- back-and-forth conversation (like talking to Claude) rather than a single
-- "Generate with AI" click. Run after 0003_ai_models.sql.

create table if not exists public.site_messages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  section_key text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists site_messages_site_section_created_idx
  on public.site_messages (site_id, section_key, created_at);

alter table public.site_messages enable row level security;

-- Same ownership pattern as site_versions: readable/insertable only via a
-- join back to a site the current user owns.
create policy "site_messages: read own" on public.site_messages
  for select using (
    exists (
      select 1 from public.sites
      where sites.id = site_messages.site_id and sites.user_id = auth.uid()
    )
  );

create policy "site_messages: insert own" on public.site_messages
  for insert with check (
    exists (
      select 1 from public.sites
      where sites.id = site_messages.site_id and sites.user_id = auth.uid()
    )
  );
