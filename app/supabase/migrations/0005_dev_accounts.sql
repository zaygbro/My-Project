-- Francisity: a hand-flagged internal dev account gets unlimited access
-- (mapped to the existing "studio" plan tier) without a real subscription.
-- There is deliberately no self-service way to set this column — it's set
-- by running SQL directly in Supabase's SQL Editor. Run after
-- 0004_section_chat.sql.

alter table public.profiles
  add column if not exists is_dev boolean not null default false;
