import { createClient } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";
import { getMonthlyEditCount } from "@/lib/quota";
import { UpgradeButton, ManageBillingButton } from "../BillingButtons";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: subscription }, { count: siteCount }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const plan = (subscription?.plan ?? "spark") as PlanId;
  const limits = PLAN_LIMITS[plan];
  const rebuildsUsed = limits.rebuildLimit !== null ? await getMonthlyEditCount(supabase, user.id) : 0;

  return (
    <div className="fade-in-up space-y-8">
      <h1 className="text-2xl font-extrabold">Settings</h1>

      <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-neutral-500">Account</h2>
        <p className="text-sm">{user.email}</p>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wide text-blue-500">Current plan</span>
            <h2 className="text-2xl font-extrabold">{PLAN_LABELS[plan]}</h2>
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
