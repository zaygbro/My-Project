import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";
import { NewSiteForm } from "./NewSiteForm";
import { UpgradeButton, ManageBillingButton } from "./BillingButtons";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects signed-out visitors away from /dashboard;
  // this is just a type-safe fallback.
  if (!user) return null;

  const [{ data: subscription }, { data: sites, count }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
    supabase
      .from("sites")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const plan = (subscription?.plan ?? "spark") as PlanId;
  const limits = PLAN_LIMITS[plan];
  const siteCount = count ?? 0;
  const atLimit = limits.siteLimit !== null && siteCount >= limits.siteLimit;
  const nearLimit = limits.siteLimit !== null && siteCount === limits.siteLimit - 1;

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-lg font-extrabold uppercase tracking-tight">
            Francisity
          </Link>
          <form action={signOut}>
            <button className="font-mono text-xs uppercase tracking-wide text-neutral-500 hover:text-white">
              Sign out
            </button>
          </form>
        </header>

        {/* Plan + usage */}
        <section className="mb-6 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wide text-blue-500">Current plan</span>
              <h1 className="text-2xl font-extrabold">{PLAN_LABELS[plan]}</h1>
              <p className="mt-1 text-sm text-neutral-400">
                {limits.siteLimit === null
                  ? "Unlimited sites"
                  : `${siteCount} / ${limits.siteLimit} sites used`}
                {limits.badge && " · “Built with Francisity” badge on"}
              </p>
            </div>
            <div className="flex gap-2">
              {plan === "spark" ? (
                <UpgradeButton plan="pro" period="monthly" label="Upgrade to Pro" />
              ) : (
                <ManageBillingButton />
              )}
            </div>
          </div>

          {(nearLimit || atLimit) && (
            <div className="mt-4 rounded-lg border border-blue-900 bg-blue-950/40 px-4 py-3 text-sm text-blue-300">
              {atLimit
                ? `You're at your ${limits.siteLimit}-site limit on ${PLAN_LABELS[plan]}. Upgrade to create more.`
                : `You're at ${siteCount}/${limits.siteLimit} sites on ${PLAN_LABELS[plan]} — one more and you'll need to upgrade.`}
            </div>
          )}
        </section>

        {/* New site */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-neutral-500">New site</h2>
          <NewSiteForm disabled={atLimit} />
        </section>

        {/* Sites list */}
        <section>
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-neutral-500">Your sites</h2>
          {sites && sites.length > 0 ? (
            <ul className="space-y-2">
              {sites.map((site) => (
                <li
                  key={site.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{site.name}</p>
                    {site.brief && <p className="text-sm text-neutral-500">{site.brief}</p>}
                  </div>
                  {site.badge_enabled && (
                    <span className="rounded-full border border-neutral-700 px-2 py-1 font-mono text-[10px] uppercase text-neutral-500">
                      Badge on
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">No sites yet — create your first one above.</p>
          )}
        </section>
      </div>
    </main>
  );
}
