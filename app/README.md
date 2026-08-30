# Francisity — Account & Billing App

The account/billing app: sign-in, a dashboard, plan/site limits, Stripe
billing (Phase 1), per-site content editing with version history and
analytics (Phase 2), export-to-code (Phase 3), and real AI-assisted
section drafting via the Claude API, for the Spark / Pro / Studio tiers
described on the marketing site (`../index.html`). It's a separate
Next.js app so the static marketing site can keep deploying anywhere,
cheaply, while this piece runs where it needs a server (Vercel, or any
Node host).

**What's here:** accounts, plan limits, billing, and a real (if narrow)
slice of AI generation — a user can pick a Claude model (with a
recommendation) and click "Generate with AI" to draft one section's
copy for real.
**What's not here:** the full multi-engine "council" from the marketing
copy — there's no concurrent structure/visual/copy/assurance pipeline,
no full-site generation from a brief, and `createSite` still just seeds
the first section with the brief text verbatim rather than an AI draft
of it.

## 1. Create a Supabase project

1. [supabase.com](https://supabase.com) → New project.
2. **Project Settings → API** — copy the Project URL and the `anon`
   public key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Copy the `service_role` key too, as
   `SUPABASE_SERVICE_ROLE_KEY` — keep this one server-only.
3. **SQL Editor** — paste and run `supabase/migrations/0001_init.sql`,
   `0002_phase2.sql`, then `0003_ai_models.sql`, in that order. The first
   creates `profiles`, `subscriptions`, and `sites`, turns on Row Level
   Security, and adds a trigger that gives every new user a `profiles`
   row and a free-plan `subscriptions` row automatically. The second
   adds structured site `content`, `site_versions`
   (version history/rollback), and `site_events` (analytics). The third
   adds `sites.preferred_model` for AI section drafting.
4. **Authentication → URL Configuration** — add
   `http://localhost:3000/auth/callback` (and your production URL's
   equivalent) to Redirect URLs.
5. **Authentication → Providers → Email** — magic-link sign-in (OTP) is
   on by default; no extra config needed for local dev. For production,
   set up a custom SMTP sender so magic-link emails don't hit Supabase's
   shared rate limit.

## 2. Create Stripe products & prices

In the Stripe Dashboard (test mode is fine to start):

1. **Product catalog → Add product** — "Francisity Pro". Add two
   recurring prices: monthly ($12) and yearly ($120 — this is the "2
   months free" annual price from the pricing page). Copy each price's
   ID (`price_...`) into `STRIPE_PRICE_PRO_MONTHLY` /
   `STRIPE_PRICE_PRO_ANNUAL`.
2. Repeat for "Francisity Studio" — monthly $39, yearly $390 — into
   `STRIPE_PRICE_STUDIO_MONTHLY` / `STRIPE_PRICE_STUDIO_ANNUAL`.
3. **Developers → API keys** — copy the secret key into
   `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks → Add endpoint** —
   `https://<your-domain>/api/stripe/webhook`, listening for
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`. Copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`.
   - For local dev, use the [Stripe CLI](https://stripe.com/docs/stripe-cli)
     instead: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
     prints a webhook secret you can use locally.

Spark has no Stripe price — it's the default free plan every new
`subscriptions` row starts on.

## 3. Enable AI generation (optional)

Get an API key from [console.anthropic.com](https://console.anthropic.com)
and set it as `ANTHROPIC_API_KEY`. Without it, "Generate with AI" stays
visibly disabled on every site's page rather than pretending to work —
everything else in the app functions normally.

## 4. Configure and run

```bash
cp .env.example .env.local   # then fill in the values above
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll land on `/sign-in`.

## How it fits together

- **Auth**: Supabase magic-link (passwordless). `src/proxy.ts` (Next 16's
  renamed `middleware.ts`) refreshes the session on every request and
  redirects signed-out visitors away from `/dashboard` and everything
  under it.
- **Plan limits**: `src/lib/plans.ts` is the single source of truth for
  site caps, rebuild caps, and badge visibility per plan — keep it in
  sync with the pricing copy on the marketing site.
- **Checkout**: `POST /api/stripe/checkout` creates a Stripe Checkout
  Session for the signed-in user and returns its URL.
- **Billing portal**: `POST /api/stripe/portal` lets an existing
  customer manage or cancel their subscription via Stripe's hosted
  portal.
- **Webhook**: `POST /api/stripe/webhook` is the *only* writer of the
  `subscriptions` table's plan/status — it verifies Stripe's signature,
  then updates Supabase using the service-role key (bypassing RLS).
- **Site limits**: enforced server-side in `dashboard/actions.ts`
  (`createSite`), not just in the UI — the free tier's cap can't be
  bypassed by calling the action directly.
- **Site content & rebuilds**: each site has structured `content`
  (an array of `{key, title, body}` sections — see `SiteSection` in
  `lib/supabase/types.ts`). Editing a section via
  `dashboard/sites/[id]/SectionEditor.tsx` calls the `updateSiteSection`
  server action, which checks the plan's monthly rebuild quota (counted
  from real `site_versions` rows, not a manually-incremented counter,
  so there's no separate monthly-reset job to maintain) before writing.
- **Version history & rollback**: every section edit — and every site's
  creation — writes a full content snapshot to `site_versions`.
  `rollbackToVersion` restores one as a new `'rollback'`-kind version
  (non-destructive; rollbacks don't consume rebuild quota).
- **Analytics**: `POST /api/track` is a public, unauthenticated endpoint
  a published site calls to record a view into `site_events`. Nothing
  calls it yet because there's no hosting pipeline serving published
  sites — a site's own analytics panel (`dashboard/sites/[id]/page.tsx`)
  reads real rows and shows an honest empty state instead of inventing
  numbers.
- **Platform analytics (dev only)**: `dashboard/analytics/page.tsx` is a
  revenue + activity overview across every account, not just the
  signed-in one — `notFound()` for anyone whose `profiles.is_dev` isn't
  set (there's no self-service way to set it; flip it directly in
  Supabase's SQL Editor, see `0005_dev_accounts.sql`). It queries with
  `createAdminClient()` (service role, bypasses RLS) rather than the
  per-request client every other page uses. Revenue (MRR/ARR) is
  computed from real active/trialing rows in `subscriptions` priced
  against Stripe's own `prices.retrieve()` for the configured
  `STRIPE_PRICE_IDS` — not a second hardcoded copy of the marketing
  site's prices — so it reads "—" rather than a wrong number when
  Stripe isn't configured or a price ID doesn't resolve.
- **Export to code**: `GET /api/sites/[id]/export` (Pro/Studio only,
  via `PLAN_LIMITS[plan].exportEnabled`) renders a site's sections into
  a plain static HTML/CSS pair (`lib/export.ts`, with real HTML
  escaping) and streams it back as a `.zip`. It's a genuinely
  dependency-free starting point, not a copy of the marketing site's
  design — the "Export to code" button on a site's page is a plain
  download link, no client JS needed.
- **AI-assisted section drafting**: `lib/ai/models.ts` is the catalog of
  four real, current Claude models (Haiku 4.5 / Sonnet 5 / Opus 5 /
  Fable 5, with accurate pricing) plus `recommendModel()`, a pure
  word-count heuristic that picks a sensible default from a site's
  brief — short brief -> Haiku, typical -> Sonnet, long/detailed ->
  Opus. Fable 5 (the priciest tier) is never auto-recommended; it's an
  explicit choice. The picker shows in `NewSiteForm` (live, as you
  type the brief) and on a site's page (`ModelSettingsForm`, to change
  it later). `lib/ai/generate.ts` calls the real Anthropic SDK
  (`@anthropic-ai/sdk`) — genuinely tested end-to-end: with no key
  configured it makes a real request and surfaces the real 401 rather
  than a mocked failure. `generateSectionWithAI` (in
  `dashboard/actions.ts`) writes the model's draft through the same
  `writeSectionEdit` path a manual save uses, so it creates a real
  version snapshot and consumes rebuild quota identically — there's no
  separate "free AI generation" loophole.

## Connecting the marketing site

Done: the marketing site's nav/hero/pricing CTAs in `../index.html` link
straight to `/try` on this app's deployed URL instead of an in-page
waitlist, and the hero's demo bar hands off the typed brief via
`/try?brief=...`, which `try/page.tsx` pre-fills. If this app's deployment
URL ever changes, update the hardcoded URL in `../index.html` and
`../script.js` to match.

## Deliberately not built yet

Per the phased roadmap, the rest of Phase 3 is intentionally still
out: **team seats** (would mean migrating site/subscription ownership
from user to workspace — the most invasive change on the list),
**pay-per-extra-site** (a real one-time Stripe purchase, straightforward
but not yet wired up), and the **style-pack marketplace** (needs Stripe
Connect for real creator payouts — a much bigger integration, and the
revenue split is a business decision, not an engineering one). **Rush
build** specifically can't be built honestly yet at all: there's no
generation queue for it to skip.

AI generation itself is real for one section at a time (see above), but
the full "council" from the marketing copy isn't: there's no
structure/visual/copy/assurance pipeline, no concurrent multi-engine
drafting, and no whole-site generation from a brief — `createSite`
still seeds the first section with the brief text as typed, not an AI
draft of it. Don't add copy implying any of the above (Phase 3 items or
the full council) exists until it does.

## UI polish & motion

- **Toasts** (Sonner, `<Toaster />` in `layout.tsx`) replaced the old
  static inline "Saved."/error paragraphs across every form. The
  pattern throughout: `useActionState` for the action result,
  `toast.success`/`toast.error` fired from a `useEffect` watching that
  result — never from inside the server action itself, and never a
  `setState` call inside that effect (React Compiler's
  `react-hooks/set-state-in-effect` lint rule catches that). Where a
  component also needs to reset its own local state after an action
  succeeds (`NewSiteForm`, the section editors' body field tracking an
  external update), that reset happens conditionally *during render* —
  React's "adjust state when a prop changes" pattern — not in an
  effect.
- **Motion tokens** live in `globals.css`: `--ease-out` / `--ease-in-out`
  plus `.press` (button/link press feedback), `.hover-lift` (touch-safe
  card hover), `.field-transition` (input focus), `.fade-in-up`
  (one-shot entrance, staggered via inline `animationDelay` — used for
  page sections and list items, never for something seen dozens of
  times a day), `.badge-pop` (a mount/unmount pop for the "Recommended"
  model badge), and `.spinner` (linear, for in-progress buttons). All
  respect `prefers-reduced-motion`. Extend these tokens for new motion
  rather than inventing new curves inline.
