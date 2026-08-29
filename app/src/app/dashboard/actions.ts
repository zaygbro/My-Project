"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";
import { getMonthlyEditCount } from "@/lib/quota";
import type { SiteSection } from "@/lib/supabase/types";
import { isAiModelId, recommendModel, type AiModelId } from "@/lib/ai/models";
import { chatAboutSection, isAnthropicConfigured, type ChatTurn } from "@/lib/ai/generate";
import { getEffectivePlanForUser } from "@/lib/dev-mode";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface CreateSiteState {
  error: string | null;
  success?: boolean;
}

const LEADING_FILLER =
  /^(please\s+)?(build|create|make|design|generate|i\s+want|i\s+need|i.d\s+like)\s+(me\s+)?(a|an|the)?\s*(modern|simple|minimalist|elegant|professional|clean|beautiful|sleek|bold|playful|new|small)?\s*(website|site|landing\s*page|page|portfolio|storefront|store|app)?\s*(for|about|to\s+showcase|to\s+promote)?\s*/i;
const NAMED_PATTERN = /\b(?:called|named)\s+((?:[A-Z][\w'&-]*\s*)+)/;

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** There's no separate "site name" field in the create form — Francisity
 * derives one from the brief itself, the same way a person would title a
 * doc from its first line: strip the "build a modern website for" scaffolding
 * to get at the actual subject ("build a website for Starbucks" -> "Starbucks",
 * "build a modern website for a coffee shop" -> "Modern Coffee Shop"), or pick
 * up an explicit "called X"/"named X" business name when the brief gives one.
 * Deterministic and free (no AI call) rather than asking a model to name a
 * site that hasn't been written yet. */
function deriveNameFromBrief(brief: string): string {
  const cleaned = brief.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Untitled site";

  const namedMatch = cleaned.match(NAMED_PATTERN);
  if (namedMatch) return titleCase(namedMatch[1].trim());

  const match = cleaned.match(LEADING_FILLER);
  let subject = match ? cleaned.slice(match[0].length) : cleaned;
  const adjective = match?.[5];
  subject = subject.replace(/^(a|an|the)\s+/i, "");
  if (!subject) subject = cleaned;

  const startsCapitalized = /^[A-Z]/.test(subject);
  if (adjective && !startsCapitalized) subject = `${adjective} ${subject}`;

  const words = subject.split(" ").slice(0, 6).join(" ");
  const titled = titleCase(words);
  return titled.length > 60 ? `${titled.slice(0, 57)}…` : titled;
}

export async function createSite(
  _prevState: CreateSiteState,
  formData: FormData
): Promise<CreateSiteState> {
  const brief = String(formData.get("brief") ?? "").trim();
  const requestedModel = String(formData.get("model") ?? "");
  const model: AiModelId = isAiModelId(requestedModel) ? requestedModel : recommendModel(brief);

  if (!brief) {
    return { error: "Describe the site you want to build." };
  }
  const name = deriveNameFromBrief(brief);

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

  const plan = await getEffectivePlanForUser(supabase, user.id, (subscription?.plan ?? "spark") as PlanId);
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
  const plan = await getEffectivePlanForUser(supabase, user.id, (subscription?.plan ?? "spark") as PlanId);

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

export interface SendMessageState {
  error: string | null;
  success?: boolean;
  reply?: string;
}

/** One turn of the per-section AI chat: persists both sides of the exchange
 * and, unless the reply was purely conversational, writes the new body
 * through the same path a manual save uses (real version snapshot, same
 * rebuild quota — there's no separate "free chat editing" loophole). */
export async function sendSectionMessage(
  siteId: string,
  sectionKey: string,
  _prevState: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Message can't be empty." };

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
  const plan = await getEffectivePlanForUser(supabase, user.id, (subscription?.plan ?? "spark") as PlanId);

  const quotaError = await checkRebuildQuota(supabase, user.id, plan);
  if (quotaError) return { error: quotaError };

  const currentContent = site.content as SiteSection[];
  const section = currentContent.find((s) => s.key === sectionKey);
  if (!section) return { error: "Unknown section." };

  const { data: historyRows } = await supabase
    .from("site_messages")
    .select("role, content")
    .eq("site_id", siteId)
    .eq("section_key", sectionKey)
    .order("created_at", { ascending: true });
  const history: ChatTurn[] = (historyRows ?? []).map((row) => ({ role: row.role, content: row.content }));

  const { error: userMessageError } = await supabase.from("site_messages").insert({
    site_id: siteId,
    section_key: sectionKey,
    role: "user",
    content: message,
  });
  if (userMessageError) return { error: userMessageError.message };

  let result: { reply: string; body: string };
  try {
    result = await chatAboutSection({
      model: site.preferred_model,
      siteName: site.name,
      siteBrief: site.brief,
      sectionTitle: section.title,
      currentBody: section.body,
      history,
      message,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI response failed." };
  }

  const { error: assistantMessageError } = await supabase.from("site_messages").insert({
    site_id: siteId,
    section_key: sectionKey,
    role: "assistant",
    content: result.reply,
  });
  if (assistantMessageError) return { error: assistantMessageError.message };

  if (result.body !== section.body) {
    const { error: writeError } = await writeSectionEdit(supabase, siteId, currentContent, sectionKey, result.body);
    if (writeError) return { error: writeError };
  }

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { error: null, success: true, reply: result.reply };
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
