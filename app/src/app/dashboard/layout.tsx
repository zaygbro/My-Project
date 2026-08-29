import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getEffectivePlanForUser, isDevUser, isViewingAsRegular } from "@/lib/dev-mode";
import { Sidebar } from "./Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Middleware already redirects signed-out visitors away from /dashboard;
  // this is just a type-safe fallback.
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: sites }, isDev, plan] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    isDevUser(user.id),
    getEffectivePlanForUser(user.id),
  ]);
  const viewingAsRegular = isDev ? await isViewingAsRegular() : false;

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar
        email={user.email ?? ""}
        sites={sites ?? []}
        isDev={isDev}
        viewingAsRegular={viewingAsRegular}
        showUpgradeNudge={plan === "spark"}
      />
      <main className="dashboard-glow min-w-0 flex-1 overflow-y-auto px-6 pt-16 pb-10 sm:px-10 md:pt-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
