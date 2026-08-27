"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";
import { getMonthlyEditCount } from "@/lib/quota";
import type { SiteSection } from "@/lib/supabase/types";
import { isAiModelId, recommendModel, type AiModelId } from "@/lib/ai/models";
import { generateSectionDraft, isAnthropicConfigured } from "@/lib/ai/generate";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface CreateSiteState {
  error: string | null;
  success?: boolean;
}

export async function createSite(
  _prevState: CreateSiteState,
  formData: FormData
): Promise<CreateSiteState> {
  const name = String(formData.get("name") ?? "").trim();
  const brief = String(formData.get("brief") ?? "").trim();
  const requestedModel = String(formData.get("model") ?? "");
  const model: AiModelId = isAiModelId(requestedModel) ? requestedModel : recommendModel(brief);

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
        error: `You're at the ${limit}-site limit on ${PLAN_LABELS[plan]}. Upgrade to add more.`,
      };
    }
  }

  const initialContent: SiteSection[] = [
    {
      key: "overview",
      title: "Overview",
      body: brief || `A new site called "${name}". Edit this section to get started.`,
    },
  ];

  const { data: site, error } = await supabase
    .from("sites")
    .insert({
      user_id: user.id,
      name,
      brief: brief || null,
      badge_enabled: PLAN_LIMITS[plan].badge,
      content: initialContent,
      preferred_model: model,
    })
    .select("id")
    .single();

  if (error || !site) {
    return { error: error?.message ?? "Couldn't create the site." };
  }

  // Seed version history with the site's starting content so "roll back to
  // when this was created" is always available.
  await supabase.from("site_versions").insert({
    site_id: site.id,
    content: initialContent,
    changed_sections: [],
    kind: "create",
  });

  revalidatePath("/dashboard");
  return { error: null, success: true };
}

/** Shared by manual edits and AI-generated ones: writes the new content and a version snapshot. */
async function writeSectionEdit(
  supabase: SupabaseClient<Database>,
  siteId: string,
  currentContent: SiteSection[],
  sectionKey: string,
  newBody: string
): Promise<{ error: string | null }> {
  const newContent = currentContent.map((s) => (s.key === sectionKey ? { ...s, body: newBody } : s));

  const { error: updateError } = await supabase
    .from("sites")
    .update({ content: newContent })
    .eq("id", siteId);
  if (updateError) return { error: updateError.message };

  const { error: versionError } = await supabase.from("site_versions").insert({
    site_id: siteId,
    content: newContent,
    changed_sections: [sectionKey],
    kind: "edit",
  });
  if (versionError) return { error: versionError.message };

  return { error: null };
}

async function checkRebuildQuota(
  supabase: SupabaseClient<Database>,
  userId: string,
  plan: PlanId
): Promise<string | null> {
  const rebuildLimit = PLAN_LIMITS[plan].rebuildLimit;
  if (rebuildLimit === null) return null;

  const used = await getMonthlyEditCount(supabase, userId);
  if (used >= rebuildLimit) {
    return `You've used all ${rebuildLimit} rebuilds included on ${PLAN_LABELS[plan]} this month. Upgrade for unlimited rebuilds.`;
  }
  return null;
}

export interface UpdateSectionState {
  error: string | null;
  success?: boolean;
}

export async function updateSiteSection(
  siteId: string,
  sectionKey: string,
  _prevState: UpdateSectionState,
  formData: FormData
): Promise<UpdateSectionState> {
  const body = String(formData.get("body") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: site } = await supabase
    .from("sites")
    .select("id, content")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (!site) return { error: "Site not found." };

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .single();
  const plan = (subscription?.plan ?? "spark") as PlanId;

  const quotaError = await checkRebuildQuota(supabase, user.id, plan);
  if (quotaError) return { error: quotaError };

  const currentContent = site.content as SiteSection[];
  if (!currentContent.some((s) => s.key === sectionKey)) {
    return { error: "Unknown section." };
  }

  const { error: writeError } = await writeSectionEdit(supabase, siteId, currentContent, sectionKey, body);
  if (writeError) return { error: writeError };

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { error: null, success: true };
}

export interface GenerateSectionState {
  error: string | null;
  success?: boolean;
}

export async function generateSectionWithAI(
  siteId: string,
  sectionKey: string,
  _prevState: GenerateSectionState,
  _formData: FormData
): Promise<GenerateSectionState> {
  if (!isAnthropicConfigured) {
    return { error: "AI generation isn't configured yet — set ANTHROPIC_API_KEY." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, brief, content, preferred_model")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (!site) return { error: "Site not found." };

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .single();
  const plan = (subscription?.plan ?? "spark") as PlanId;

  const quotaError = await checkRebuildQuota(supabase, user.id, plan);
  if (quotaError) return { error: quotaError };

  const currentContent = site.content as SiteSection[];
  const section = currentContent.find((s) => s.key === sectionKey);
  if (!section) return { error: "Unknown section." };

  let draft: string;
  try {
    draft = await generateSectionDraft({
      model: site.preferred_model,
      siteName: site.name,
      siteBrief: site.brief,
      sectionTitle: section.title,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI generation failed." };
  }

  const { error: writeError } = await writeSectionEdit(supabase, siteId, currentContent, sectionKey, draft);
  if (writeError) return { error: writeError };

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { error: null, success: true };
}

export interface UpdateModelState {
  error: string | null;
  success?: boolean;
}

export async function updateSitePreferredModel(
  siteId: string,
  _prevState: UpdateModelState,
  formData: FormData
): Promise<UpdateModelState> {
  const model = String(formData.get("model") ?? "");
  if (!isAiModelId(model)) {
    return { error: "Unknown model." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase
    .from("sites")
    .update({ preferred_model: model })
    .eq("id", siteId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { error: null, success: true };
}

export interface RollbackState {
  error: string | null;
  success?: boolean;
}

export async function rollbackToVersion(
  siteId: string,
  versionId: string,
  _prevState: RollbackState,
  _formData: FormData
): Promise<RollbackState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (!site) return { error: "Site not found." };

  const { data: version } = await supabase
    .from("site_versions")
    .select("content")
    .eq("id", versionId)
    .eq("site_id", siteId)
    .single();
  if (!version) return { error: "Version not found." };

  const { error: updateError } = await supabase
    .from("sites")
    .update({ content: version.content })
    .eq("id", siteId);
  if (updateError) return { error: updateError.message };

  const { error: versionError } = await supabase.from("site_versions").insert({
    site_id: siteId,
    content: version.content,
    changed_sections: [],
    kind: "rollback",
  });
  if (versionError) return { error: versionError.message };

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { error: null, success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
