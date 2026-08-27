"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, type PlanId } from "@/lib/plans";

export interface CreateSiteState {
  error: string | null;
}

export async function createSite(
  _prevState: CreateSiteState,
  formData: FormData
): Promise<CreateSiteState> {
  const name = String(formData.get("name") ?? "").trim();
  const brief = String(formData.get("brief") ?? "").trim();

  if (!name) {
    return { error: "Give your site a name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .single();

  const plan = (subscription?.plan ?? "spark") as PlanId;
  const limit = PLAN_LIMITS[plan].siteLimit;

  if (limit !== null) {
    const { count } = await supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= limit) {
      return {
        error: `You're at the ${limit}-site limit on the ${plan} plan. Upgrade to add more.`,
      };
    }
  }

  const { error } = await supabase.from("sites").insert({
    user_id: user.id,
    name,
    brief: brief || null,
    badge_enabled: PLAN_LIMITS[plan].badge,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { error: null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
