# Francisity — Account & Billing App

The account/billing app: sign-in, a dashboard, plan/site limits, Stripe
billing (Phase 1), and per-site content editing with version history and
analytics (Phase 2), for the Spark / Pro / Studio tiers described on the
marketing site (`../index.html`). It's a separate Next.js app so the
static marketing site can keep deploying anywhere, cheaply, while this
piece runs where it needs a server (Vercel, or any Node host).

**What's here:** accounts, plan limits, and billing plumbing.
**What's not here:** the actual AI site-generation engine — `createSite`
just records a row (name + brief) as a placeholder for where that
pipeline will hook in.

## 1. Create a Supabase project

1. [supabase.com](https://supabase.com) → New project.
2. **Project Settings → API** — copy the Project URL and the `anon`
   public key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Copy the `service_role` key too, as
   `SUPABASE_SERVICE_ROLE_KEY` — keep this one server-only.
3. **SQL Editor** — paste and run `supabase/migrations/0001_init.sql`,
   then `0002_phase2.sql`, in that order. The first creates `profiles`,
   `subscriptions`, and `sites`, turns on Row Level Security, and adds a
   trigger that gives every new user a `profiles` row and a free-plan
   `subscriptions` row automatically. The second adds structured site
   `content`, `site_versions` (version history/rollback), and
   `site_events` (analytics).
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
   recurring prices: monthly ($29) and yearly ($290 — this is the "2
   months free" annual price from the pricing page). Copy each price's
   ID (`price_...`) into `STRIPE_PRICE_PRO_MONTHLY` /
   `STRIPE_PRICE_PRO_ANNUAL`.
2. Repeat for "Francisity Studio" — monthly $99, yearly $990 — into
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

## 3. Configure and run

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
  sites — the dashboard's analytics panel reads real rows and shows an
  honest empty state instead of inventing numbers.
- **Export to code**: `GET /api/sites/[id]/export` (Pro/Studio only,
  via `PLAN_LIMITS[plan].exportEnabled`) renders a site's sections into
  a plain static HTML/CSS pair (`lib/export.ts`, with real HTML
  escaping) and streams it back as a `.zip`. It's a genuinely
  dependency-free starting point, not a copy of the marketing site's
  design — the "Export to code" button on a site's page is a plain
  download link, no client JS needed.

## Connecting the marketing site

Once this app is deployed (e.g. to `app.francisity.com` or
`francisity.com/app`), update the marketing site's `#brief`/pricing CTA
links in `../index.html` to point here instead of the in-page waitlist
anchor.

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

The actual AI site-generation engine is also still out of scope
everywhere — `createSite` and `updateSiteSection` write real rows and
real version history, but nothing generates the content itself yet.
Don't add copy implying any of the above exists until it does.
