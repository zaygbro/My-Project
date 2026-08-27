# Francisity — Account & Billing App

The Phase 1 MVP monetization app: sign-in, a dashboard, plan/site limits,
and Stripe billing for the Spark / Pro / Studio tiers described on the
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
3. **SQL Editor** — paste and run `supabase/migrations/0001_init.sql`.
   It creates `profiles`, `subscriptions`, and `sites`, turns on Row
   Level Security, and adds a trigger that gives every new user a
   `profiles` row and a free-plan `subscriptions` row automatically.
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

- **Auth**: Supabase magic-link (passwordless). `middleware.ts` refreshes
  the session on every request and redirects signed-out visitors away
  from `/dashboard`.
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

## Connecting the marketing site

Once this app is deployed (e.g. to `app.francisity.com` or
`francisity.com/app`), update the marketing site's `#brief`/pricing CTA
links in `../index.html` to point here instead of the in-page waitlist
anchor.

## Deliberately not built yet

Per the phased roadmap: team seats, analytics dashboards, version
history/rollback, the style-pack marketplace, and pay-as-you-go add-ons
(rush builds, extra sites) are Phase 2+ and not implemented. Don't add
copy implying they exist until they do.
