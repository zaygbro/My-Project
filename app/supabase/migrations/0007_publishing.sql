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
