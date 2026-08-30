-- Francisity — apply migrations 0006 + 0007 together.
-- Paste this ENTIRE file into the Supabase SQL Editor and press Run.
-- Safe to re-run: every statement is guarded (if not exists / no-op updates).

-- Francisity: real AI generation wired into site creation.
--
-- Until now a new site was a single flat list of sections (`sites.content`)
-- with no design tokens and no generation state — the real multi-page
-- pipeline in lib/generation/ only ran in an unwired prototype and never
-- persisted anything. This migration gives sites somewhere to put that
-- pipeline's actual output.
--
-- `pages` becomes the single source of truth for site content. Every
-- existing site is backfilled into a one-page site (slug 'index') so there
-- is never a dual-read fallback between `content` and `pages`. `content` is
-- deliberately left in place (not dropped) so this migration is reversible
-- and no existing data is destroyed — nothing reads it after this.
-- Run after 0005_dev_accounts.sql.

alter table public.sites
  add column if not exists pages jsonb not null default '[]'::jsonb,
  add column if not exists design_tokens jsonb,
  -- Existing sites are already usable content, so they default to
  -- 'validated'; only newly created sites start life as 'pending'.
  add column if not exists generation_status text not null default 'validated'
    check (generation_status in ('pending', 'generating', 'validated', 'failed')),
  add column if not exists generation_error text,
  add column if not exists change_log jsonb not null default '[]'::jsonb,
  add column if not exists total_cost_usd numeric(12, 6) not null default 0;

-- Backfill: wrap each existing site's flat sections in a single page.
-- Guarded on pages = '[]' so re-running this migration is a no-op.
update public.sites
set pages = jsonb_build_array(
  jsonb_build_object('slug', 'index', 'title', name, 'sections', content)
)
where pages = '[]'::jsonb;

-- Version snapshots need to capture the same shape they restore into,
-- otherwise a rollback would silently downgrade a multi-page site.
alter table public.site_versions
  add column if not exists pages jsonb not null default '[]'::jsonb,
  add column if not exists design_tokens jsonb;

-- `content` was declared NOT NULL with no default in 0002, back when every
-- insert supplied it. Nothing writes it any more, so without a default the
-- first `pages`-only snapshot would fail on a NOT NULL violation.
alter table public.site_versions
  alter column content set default '[]'::jsonb;

update public.site_versions v
set pages = jsonb_build_array(
  jsonb_build_object('slug', 'index', 'title', s.name, 'sections', v.content)
)
from public.sites s
where s.id = v.site_id and v.pages = '[]'::jsonb;

-- Section keys are only unique within a page ("intro" can exist on both
-- Home and About), so chat history has to be keyed by page too. The default
-- correctly attributes every pre-existing message to the 'index' page the
-- backfill above just created.
alter table public.site_messages
  add column if not exists page_slug text not null default 'index';

drop index if exists site_messages_site_section_created_idx;
create index if not exists site_messages_site_page_section_created_idx
  on public.site_messages (site_id, page_slug, section_key, created_at);

-- Lets the dashboard list "sites still building" without scanning every row.
create index if not exists sites_user_generation_status_idx
  on public.sites (user_id, generation_status);


-- Francisity: publishing. Until now `subdomain`/`custom_domain` existed but
-- nothing wrote them, /api/track had nothing calling it, and both analytics
-- panels honestly reported zero because no site was ever actually served.
-- Run after 0006_multipage_generation.sql.
--
-- Publishing SNAPSHOTS content rather than serving the live draft: editing a
-- section shouldn't silently change what visitors already see, and the gap
-- between the snapshot and the draft is what makes "unpublished changes"
-- detectable at all.

alter table public.sites
  add column if not exists published_at timestamptz,
  add column if not exists published_pages jsonb,
  add column if not exists published_design_tokens jsonb,
  add column if not exists published_name text;

-- Subdomains are compared and served lowercase, so uniqueness has to be
-- case-insensitive — otherwise "Acme" and "acme" would be two different
-- rows resolving to the same hostname. 0001 already put a plain unique
-- constraint on the column; this adds the case-insensitive guarantee.
create unique index if not exists sites_subdomain_lower_idx
  on public.sites (lower(subdomain))
  where subdomain is not null;

-- The public renderer looks a site up by subdomain on every visit.
create index if not exists sites_published_lookup_idx
  on public.sites (lower(subdomain))
  where published_at is not null;

-- Visitors are anonymous, so the published renderer reads through the
-- service-role client with an explicit column allowlist. That is deliberate:
-- RLS is row-level, not column-level, so a policy like "anyone may read rows
-- where published_at is not null" would also expose that row's DRAFT `pages`,
-- its `brief`, and its owner's user_id. There is intentionally no anon read
-- policy on `sites` — see src/app/s/[subdomain]/[[...slug]]/page.tsx.
