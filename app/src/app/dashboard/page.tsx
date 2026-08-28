import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";
import { NewSiteForm } from "./NewSiteForm";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects signed-out visitors away from /dashboard;
  // this is just a type-safe fallback.
  if (!user) return null;

  const [{ data: subscription }, { data: sites, count }] = await Promise.all([
    supabase.from("subscriptions").select("plan").eq("user_id", user.id).single(),
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

  const emailLocalPart = user.email?.split("@")[0] ?? "";
  const displayName = emailLocalPart ? emailLocalPart.charAt(0).toUpperCase() + emailLocalPart.slice(1) : "there";

  return (
    <div className="space-y-8">
      {/* New site */}
      <section className="fade-in-up">
        <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-neutral-500">
          New site, {displayName}
        </h2>
        <NewSiteForm disabled={atLimit} />
        {atLimit && (
          <p className="mt-3 text-sm text-blue-400">
            You&rsquo;re at the {limits.siteLimit}-site limit on {PLAN_LABELS[plan]}.{" "}
            <Link href="/dashboard/settings" className="underline hover:text-blue-300">
              Upgrade in Settings
            </Link>{" "}
            to create more.
          </p>
        )}
      </section>

      {/* Sites list */}
      <section className="fade-in-up" style={{ animationDelay: "80ms" }}>
        <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-neutral-500">Your sites</h2>
        {sites && sites.length > 0 ? (
          <ul className="space-y-2">
            {sites.map((site, i) => (
              <li key={site.id} className="fade-in-up" style={{ animationDelay: `${120 + i * 40}ms` }}>
                <Link
                  href={`/dashboard/sites/${site.id}`}
                  className="hover-lift press flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 transition-colors hover:border-neutral-600"
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
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No sites yet — create your first one above.</p>
        )}
      </section>
    </div>
  );
}
