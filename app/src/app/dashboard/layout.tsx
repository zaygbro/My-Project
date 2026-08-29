import { createClient } from "@/lib/supabase/server";
import { getEffectivePlanForUser, isViewingAsRegular } from "@/lib/dev-mode";
import type { PlanId } from "@/lib/plans";
import { Sidebar } from "./Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects signed-out visitors away from /dashboard;
  // this is just a type-safe fallback.
  if (!user) return null;

  const [{ data: sites }, { data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("is_dev").eq("id", user.id).single(),
    supabase.from("subscriptions").select("plan").eq("user_id", user.id).single(),
  ]);
  const viewingAsRegular = profile?.is_dev ? await isViewingAsRegular() : false;
  const plan = await getEffectivePlanForUser(supabase, user.id, (subscription?.plan ?? "spark") as PlanId);

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar
        email={user.email ?? ""}
        sites={sites ?? []}
        isDev={profile?.is_dev ?? false}
        viewingAsRegular={viewingAsRegular}
        showUpgradeNudge={plan === "spark"}
      />
      <main className="dashboard-glow min-w-0 flex-1 overflow-y-auto px-6 pt-16 pb-10 sm:px-10 md:pt-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
