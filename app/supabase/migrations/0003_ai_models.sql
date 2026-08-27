-- Francisity: per-site AI model choice for section generation.
-- Run after 0002_phase2.sql.

alter table public.sites
  add column if not exists preferred_model text not null default 'claude-sonnet-5'
    check (preferred_model in ('claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5'));
