import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevUser } from "@/lib/dev-mode";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { PLAN_LABELS, STRIPE_PRICE_IDS, type BillingPeriod, type PlanId } from "@/lib/plans";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** Buckets rows into one count per day for the trailing `days` days
 * (index 0 = oldest, last index = today), so a sparse array of
 * timestamps becomes something a bar chart can render directly. */
function bucketByDay(rows: { created_at: string }[], days: number): number[] {
  const buckets = new Array(days).fill(0) as number[];
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const row of rows) {
    const d = new Date(row.created_at);
    const dUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const index = days - 1 - Math.round((todayUtc - dUtc) / DAY_MS);
    if (index >= 0 && index < days) buckets[index] += 1;
  }
  return buckets;
}

/** Real Stripe prices for each configured plan/period, not a second
 * hardcoded copy of pricing — if a price ID isn't set (or Stripe isn't
 * configured at all), that plan/period is simply left out of the map so
 * revenue math can exclude it honestly instead of guessing a number. */
async function getPlanPricesInCents(): Promise<Partial<Record<PlanId, Partial<Record<BillingPeriod, number>>>>> {
  if (!isStripeConfigured) return {};
  const wanted: Array<[PlanId, BillingPeriod, string | undefined]> = [
    ["pro", "monthly", STRIPE_PRICE_IDS.pro.monthly],
    ["pro", "annual", STRIPE_PRICE_IDS.pro.annual],
    ["studio", "monthly", STRIPE_PRICE_IDS.studio.monthly],
    ["studio", "annual", STRIPE_PRICE_IDS.studio.annual],
  ];
  const prices: Partial<Record<PlanId, Partial<Record<BillingPeriod, number>>>> = {};
  await Promise.all(
    wanted.map(async ([plan, period, priceId]) => {
      if (!priceId) return;
      try {
        const price = await stripe.prices.retrieve(priceId);
        if (typeof price.unit_amount === "number") {
          (prices[plan] ??= {})[period] = price.unit_amount;
        }
      } catch {
        // Configured price ID doesn't resolve in Stripe — leave it out so
        // MRR honestly excludes it instead of guessing a dollar amount.
      }
    })
  );
  return prices;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="font-display mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}

function Trend({ label, values }: { label: string; values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <div className="flex h-16 items-end gap-1">
        {values.map((v, i) => (
          <div
            key={i}
            className="field-transition min-h-1 flex-1 rounded-t bg-accent/70"
            style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
            title={`${v}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint">
        <span>{TREND_DAYS} days ago</span>
        <span>today</span>
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user || !(await isDevUser(user.id))) notFound();

  // Platform-wide numbers, not just this account's own rows — every other
  // table on this page is RLS-scoped to auth.uid(), so this genuinely needs
  // the service-role client. Safe here specifically because dev status was
  // already verified above, server-side, before this line runs.
  const admin = createAdminClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const trendStart = new Date(now.getTime() - (TREND_DAYS - 1) * DAY_MS).toISOString();

  const [
    { count: totalUsers },
    { count: newUsers7d },
    { count: totalSites },
    { count: newSites7d },
    { count: totalRebuilds },
    { count: rebuilds7d },
    { count: totalViews },
    { data: activeSubs },
    { data: recentSignups },
    { data: signupTrendRows },
    { data: siteTrendRows },
    prices,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    admin.from("sites").select("id", { count: "exact", head: true }),
    admin.from("sites").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    admin.from("site_versions").select("id", { count: "exact", head: true }).eq("kind", "edit"),
    admin
      .from("site_versions")
      .select("id", { count: "exact", head: true })
      .eq("kind", "edit")
      .gte("created_at", sevenDaysAgo),
    admin.from("site_events").select("id", { count: "exact", head: true }),
    admin.from("subscriptions").select("plan, billing_period").in("status", ["active", "trialing"]).neq("plan", "spark"),
    admin.from("profiles").select("email, created_at").order("created_at", { ascending: false }).limit(8),
    admin.from("profiles").select("created_at").gte("created_at", trendStart),
    admin.from("sites").select("created_at").gte("created_at", trendStart),
    getPlanPricesInCents(),
  ]);

  const subs = activeSubs ?? [];
  const planCounts: Record<PlanId, number> = { spark: 0, pro: 0, studio: 0 };
  let mrrCents = 0;
  let unpriced = 0;
  for (const sub of subs) {
    planCounts[sub.plan] += 1;
    const period: BillingPeriod = sub.billing_period ?? "monthly";
    const amount = prices[sub.plan]?.[period];
    if (amount === undefined) {
      unpriced += 1;
      continue;
    }
    mrrCents += period === "annual" ? amount / 12 : amount;
  }
  const payingCustomers = subs.length;
  const freeUsers = Math.max(0, (totalUsers ?? 0) - payingCustomers);

  const signupTrend = bucketByDay(signupTrendRows ?? [], TREND_DAYS);
  const siteTrend = bucketByDay(siteTrendRows ?? [], TREND_DAYS);

  return (
    <div className="fade-in-up space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-accent">Dev only</p>
        <h1 className="font-display mt-1 text-2xl font-extrabold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Platform-wide revenue and activity across every account, not just yours.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">Revenue</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="MRR"
            value={isStripeConfigured ? formatUsd(mrrCents) : "—"}
            sub={
              !isStripeConfigured
                ? "Set STRIPE_SECRET_KEY to see this"
                : unpriced > 0
                  ? `${unpriced} subscription${unpriced === 1 ? "" : "s"} excluded — price not found`
                  : "From active + trialing subscriptions"
            }
          />
          <Stat
            label="ARR (projected)"
            value={isStripeConfigured ? formatUsd(mrrCents * 12) : "—"}
            sub="MRR × 12"
          />
          <Stat
            label="Paying customers"
            value={String(payingCustomers)}
            sub={`${PLAN_LABELS.pro}: ${planCounts.pro} · ${PLAN_LABELS.studio}: ${planCounts.studio}`}
          />
          <Stat label="Free users" value={String(freeUsers)} sub={`${PLAN_LABELS.spark} plan`} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">Activity</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Total users" value={String(totalUsers ?? 0)} sub={`+${newUsers7d ?? 0} in the last 7 days`} />
          <Stat label="Total sites" value={String(totalSites ?? 0)} sub={`+${newSites7d ?? 0} in the last 7 days`} />
          <Stat label="Rebuilds" value={String(totalRebuilds ?? 0)} sub={`${rebuilds7d ?? 0} in the last 7 days`} />
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-5">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">Published site views</p>
          <p className="font-display mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{totalViews ?? 0}</p>
          <p className="mt-1 text-xs text-ink-faint">
            Real views of published sites, read from the{" "}
            <code className="font-mono text-ink-dim">site_events</code> table — nothing here is simulated.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-faint">Last {TREND_DAYS} days</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Trend label="New users" values={signupTrend} />
          <Trend label="New sites" values={siteTrend} />
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-faint">Recent signups</h2>
        {recentSignups && recentSignups.length > 0 ? (
          <ul className="space-y-2">
            {recentSignups.map((p) => (
              <li
                key={p.email + p.created_at}
                className="flex items-center justify-between border-t border-hairline-soft pt-2 first:border-t-0 first:pt-0"
              >
                <span className="truncate text-sm text-ink-dim">{p.email}</span>
                <span className="font-mono text-xs text-ink-faint">
                  {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-faint">No signups yet.</p>
        )}
      </section>
    </div>
  );
}
