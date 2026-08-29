// A hand-flagged internal dev account (see 0005_dev_accounts.sql) gets
// unlimited access by being treated as already on the top-tier "studio"
// plan — no parallel fake-features system, just reuse of PLAN_LIMITS.studio.
// The view-as-regular cookie can only ever narrow a dev account's own
// privileges (for testing what regular users see); it's consulted only
// after `profile.is_dev` is already true, so it can never grant elevated
// privileges to a non-dev account.
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "./supabase/server";
import type { PlanId } from "./plans";

export const VIEW_AS_REGULAR_COOKIE = "francisity_dev_view_as_regular";

export async function isViewingAsRegular(): Promise<boolean> {
  const store = await cookies();
  return store.get(VIEW_AS_REGULAR_COOKIE)?.value === "1";
}

/** Cached per request — a layout, its page, and any nested page all asking
 * whether this user is a dev account should cost one query, not one each. */
export const isDevUser = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("is_dev").eq("id", userId).single();
  return data?.is_dev ?? false;
});

const getSubscriptionPlan = cache(async (userId: string): Promise<PlanId> => {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("plan").eq("user_id", userId).single();
  return (data?.plan ?? "spark") as PlanId;
});

/** Resolves the plan a user should actually be treated as. Every caller
 * used to run its own subscription + profile queries just to get here —
 * this now owns both lookups (each cached per request on its own) so a
 * layout/page tree only pays for them once no matter how many places ask. */
export const getEffectivePlanForUser = cache(async (userId: string): Promise<PlanId> => {
  const realPlan = await getSubscriptionPlan(userId);
  if (!(await isDevUser(userId))) return realPlan;

  const viewingAsRegular = await isViewingAsRegular();
  return viewingAsRegular ? realPlan : "studio";
});
