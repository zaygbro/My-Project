import Link from "next/link";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS } from "@/lib/plans";
import { getEffectivePlanForUser } from "@/lib/dev-mode";
import { NewSiteForm } from "./NewSiteForm";
import { SitesGrid } from "./SitesGrid";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Middleware already redirects signed-out visitors away from /dashboard;
  // this is just a type-safe fallback.
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: sites, count }, plan] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, brief, badge_enabled, generation_status", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getEffectivePlanForUser(user.id),
  ]);

  const limits = PLAN_LIMITS[plan];
  const siteCount = count ?? 0;
  const atLimit = limits.siteLimit !== null && siteCount >= limits.siteLimit;

  const emailLocalPart = user.email?.split("@")[0] ?? "";
  const displayName = emailLocalPart ? emailLocalPart.charAt(0).toUpperCase() + emailLocalPart.slice(1) : "there";

  return (
    <div className="space-y-12">
      {/* New site */}
      <section className="fade-in-up relative pt-6">
        <svg
          viewBox="0 0 600 160"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-4 mx-auto h-40 w-full max-w-2xl opacity-60"
        >
          <g stroke="#3B82F6" fill="none" strokeWidth="1">
            <path d="M60 20 L300 120" strokeOpacity="0.35" />
            <path d="M180 10 L300 120" strokeOpacity="0.5" />
            <path d="M420 10 L300 120" strokeOpacity="0.5" />
            <path d="M540 20 L300 120" strokeOpacity="0.35" />
          </g>
          <g fill="#3B82F6">
            <circle cx="60" cy="20" r="3" fillOpacity="0.6" />
            <circle cx="180" cy="10" r="3" fillOpacity="0.8" />
            <circle cx="420" cy="10" r="3" fillOpacity="0.8" />
            <circle cx="540" cy="20" r="3" fillOpacity="0.6" />
            <circle cx="300" cy="120" r="4.5" />
          </g>
        </svg>
        <h1 className="relative text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
          Let&rsquo;s build something, {displayName}
        </h1>
        <div className="relative mx-auto mt-8 max-w-2xl">
          <NewSiteForm disabled={atLimit} />
          {atLimit && (
            <p className="mt-3 text-center text-sm text-blue-400">
              You&rsquo;re at the {limits.siteLimit}-site limit on {PLAN_LABELS[plan]}.{" "}
              <Link href="/dashboard/settings" className="underline hover:text-blue-300">
                Upgrade in Settings
              </Link>{" "}
              to create more.
            </p>
          )}
        </div>
      </section>

      {/* Sites grid */}
      <section className="fade-in-up" style={{ animationDelay: "80ms" }}>
        <SitesGrid sites={sites ?? []} />
      </section>
    </div>
  );
}
