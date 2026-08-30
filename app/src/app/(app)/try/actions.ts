"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS } from "@/lib/plans";
import type { SiteSection } from "@/lib/supabase/types";
import { isAiModelId, recommendModel } from "@/lib/ai/models";
import { getEffectivePlanForUser } from "@/lib/dev-mode";

export interface ClaimAnonSiteResult {
  error: string | null;
  siteId?: string;
}

/** Turns a just-signed-up user's local-only trial site into a real, saved one. */
export async function claimAnonymousSite(payload: {
  name: string;
  brief: string;
  model: string;
  content: SiteSection[];
}): Promise<ClaimAnonSiteResult> {
  const name = payload.name.trim();
  if (!name) return { error: "Missing site name." };

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in required." };

  const plan = await getEffectivePlanForUser(user.id);
  const limit = PLAN_LIMITS[plan].siteLimit;

  if (limit !== null) {
    const { count } = await supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= limit) {
      return {
        error: `You're at the ${limit}-site limit on ${PLAN_LABELS[plan]}. Upgrade to add more.`,
      };
    }
  }

  const model = isAiModelId(payload.model) ? payload.model : recommendModel(payload.brief);
  const content: SiteSection[] =
    payload.content.length > 0
      ? payload.content
      : [{ key: "overview", title: "Overview", body: payload.brief || `A new site called "${name}".` }];

  const { data: site, error } = await supabase
    .from("sites")
    .insert({
      user_id: user.id,
      name,
      brief: payload.brief || null,
      badge_enabled: PLAN_LIMITS[plan].badge,
      content,
      preferred_model: model,
    })
    .select("id")
    .single();

  if (error || !site) {
    return { error: error?.message ?? "Couldn't save the site." };
  }

  await supabase.from("site_versions").insert({
    site_id: site.id,
    content,
    changed_sections: [],
    kind: "create",
  });

  revalidatePath("/dashboard");
  return { error: null, siteId: site.id };
}
