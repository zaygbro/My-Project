import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function startOfCurrentMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * How many section rebuilds (kind = 'edit') this user has used across all
 * their sites since the start of the current calendar month. Rollbacks
 * don't count — they restore existing content rather than generating new.
 */
export async function getMonthlyEditCount(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const { data: userSites } = await supabase.from("sites").select("id").eq("user_id", userId);
  const siteIds = (userSites ?? []).map((s) => s.id);
  if (siteIds.length === 0) return 0;

  const { count } = await supabase
    .from("site_versions")
    .select("id", { count: "exact", head: true })
    .in("site_id", siteIds)
    .eq("kind", "edit")
    .gte("created_at", startOfCurrentMonthUTC());

  return count ?? 0;
}
