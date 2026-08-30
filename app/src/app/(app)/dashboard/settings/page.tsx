import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS } from "@/lib/plans";
import { getMonthlyEditCount } from "@/lib/quota";
import { getEffectivePlanForUser, isDevUser, isViewingAsRegular } from "@/lib/dev-mode";
import { UpgradeButton, ManageBillingButton } from "../BillingButtons";
import { DevModeToggle } from "./DevModeToggle";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ count: siteCount }, isDev, plan] = await Promise.all([
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    isDevUser(user.id),
    getEffectivePlanForUser(user.id),
  ]);

  const limits = PLAN_LIMITS[plan];
  const rebuildsUsed = limits.rebuildLimit !== null ? await getMonthlyEditCount(supabase, user.id) : 0;
  const viewingAsRegular = await isViewingAsRegular();

  return (
    <div className="fade-in-up space-y-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Settings</h1>

      <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-neutral-500">Account</h2>
        <p className="text-sm">{user.email}</p>
      </section>

      {isDev && (
        <section className="rounded-xl border border-blue-900 bg-blue-950/20 p-5">
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-blue-400">Developer</h2>
          <p className="mb-3 text-sm text-neutral-400">
            Your account bypasses plan limits. Toggle this to see the app as a regular {PLAN_LABELS.spark} user would,
            for testing.
          </p>
          <DevModeToggle viewingAsRegular={viewingAsRegular} />
        </section>
      )}

      <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wide text-blue-500">Current plan</span>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">{PLAN_LABELS[plan]}</h2>
            <p className="mt-1 text-sm text-neutral-400">
              {limits.siteLimit === null ? "Unlimited sites" : `${siteCount ?? 0} / ${limits.siteLimit} sites used`}
              {" · "}
              {limits.rebuildLimit === null
                ? "Unlimited rebuilds"
                : `${rebuildsUsed} / ${limits.rebuildLimit} rebuilds this month`}
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
      </section>
    </div>
  );
}
