// A hand-flagged internal dev account (see 0005_dev_accounts.sql) gets
// unlimited access by being treated as already on the top-tier "studio"
// plan — no parallel fake-features system, just reuse of PLAN_LIMITS.studio.
// The view-as-regular cookie can only ever narrow a dev account's own
// privileges (for testing what regular users see); it's consulted only
// after `profile.is_dev` is already true, so it can never grant elevated
// privileges to a non-dev account.
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import type { PlanId } from "./plans";

export const VIEW_AS_REGULAR_COOKIE = "francisity_dev_view_as_regular";

export async function isViewingAsRegular(): Promise<boolean> {
  const store = await cookies();
  return store.get(VIEW_AS_REGULAR_COOKIE)?.value === "1";
}

export async function getEffectivePlanForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  realPlan: PlanId
): Promise<PlanId> {
  const { data: profile } = await supabase.from("profiles").select("is_dev").eq("id", userId).single();
  if (!profile?.is_dev) return realPlan;

  const viewingAsRegular = await isViewingAsRegular();
  return viewingAsRegular ? realPlan : "studio";
}
