import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects signed-out visitors away from /dashboard;
  // this is just a type-safe fallback.
  if (!user) return null;

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar email={user.email ?? ""} sites={sites ?? []} />
      <main className="min-w-0 flex-1 px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
