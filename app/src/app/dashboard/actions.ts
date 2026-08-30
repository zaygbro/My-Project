"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";
import { getMonthlyEditCount } from "@/lib/quota";
import { isAiModelId, recommendModel, type AiModelId } from "@/lib/ai/models";
import { chatAboutSection, isAnthropicConfigured, type ChatTurn } from "@/lib/ai/generate";
import { isGenerationConfigured } from "@/lib/generation/generate";
import type { GeneratedPage } from "@/lib/generation/types";
import { findSection, replaceSectionBody, sectionRef } from "@/lib/site-content";
import { getEffectivePlanForUser } from "@/lib/dev-mode";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface CreateSiteState {
  error: string | null;
  success?: boolean;
}

// "an" must come before "a" in this alternation — regex alternatives are
// tried left-to-right and the first match wins, so listing "a" first would
// match just the "a" prefix of "an" (e.g. "an app" -> stray leading "n").
const LEADING_FILLER =
  /^(please\s+)?(build|create|make|design|generate|i\s+want|i\s+need|i.d\s+like)\s+(me\s+)?(an|a|the)?\s*(modern|simple|minimalist|elegant|professional|clean|beautiful|sleek|bold|playful|new|small)?\s*(website|site|landing\s*page|page|portfolio|storefront|store|app)?\s*(for|about|to\s+showcase|to\s+promote)?\s*/i;
const NAMED_PATTERN = /\b(?:called|named)\s+((?:[A-Z][\w'&-]*\s*)+)/;
const QUOTED_PATTERN = /"([^"]{1,60})"/;

function titleCase(s: string): string {
  // Capitalize only after start-of-string or a non-letter/non-apostrophe
  // boundary — a plain \b\w boundary would also fire right after an
  // apostrophe and turn "Joe's" into "Joe'S".
  return s.replace(/(^|[^A-Za-z'])([a-z])/g, (_, boundary: string, letter: string) => boundary + letter.toUpperCase());
}

/** There's no separate "site name" field in the create form — Francisity
 * derives one from the brief itself, the same way a person would title a
 * doc from its first line: strip the "build a modern website for" scaffolding
 * to get at the actual subject ("build a website for Starbucks" -> "Starbucks",
 * "build a modern website for a coffee shop" -> "Modern Coffee Shop"), or pick
 * up an explicit "called X"/"named X" business name, or a quoted name, when
 * the brief gives one. Deterministic and free (no AI call) rather than
 * asking a model to name a site that hasn't been written yet. */
function deriveNameFromBrief(brief: string): string {
  const cleaned = brief.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Untitled site";

  // A quoted name is the strongest signal ("build a site called \"Best Site
  // Ever\"" — NAMED_PATTERN alone would stall on the opening quote). Guard
  // on a capital first letter so a decorative quote around an ordinary word
  // ("bread that's truly \"artisan\"") doesn't hijack the whole name.
  const quoted = cleaned.match(QUOTED_PATTERN);
  if (quoted && /^[A-Z]/.test(quoted[1].trim())) return titleCase(quoted[1].trim());

  const namedMatch = cleaned.match(NAMED_PATTERN);
  if (namedMatch) return titleCase(namedMatch[1].trim());

  const match = cleaned.match(LEADING_FILLER);
  // The whole brief was command scaffolding with no real subject at all
  // ("build a website") — better to say so than title-case the scaffolding.
  if (match && match[0].length === cleaned.length) return "Untitled site";

  let subject = match ? cleaned.slice(match[0].length) : cleaned;
  const adjective = match?.[5];

  // An unrecognized word (a typo like "wesbite", or a compound like
  // "ecommerce store") before "for" won't match the noun slot above, so the
  // filler regex gives up early and leaves "<word(s)> for " on the front of
  // subject — catch that structurally here rather than maintaining a
  // dictionary of every noun and typo. Skip it when that leftover phrase is
  // capitalized, since that's more likely the real subject than a mangled
  // site-type word.
  const leftoverFor = subject.match(/^(?:(?:a|an|the)\s+)?((?:\S+\s+){0,2}\S+)\s+for\s+(.+)/i);
  if (leftoverFor && !/^[A-Z]/.test(leftoverFor[1])) {
    subject = leftoverFor[2];
  }

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
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

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

  // The site row is created empty and `pending`: the real multi-page
  // generation runs from the site's own page, which streams its progress.
  // Creating a site therefore returns immediately instead of blocking this
  // action (and the user's tab) on a 20-60s model call that might fail.
  //
  // When generation isn't configured at all, skip straight to a validated
  // one-page site holding the brief, so the app stays usable without a key
  // rather than parking every new site in a build screen that can't finish.
  const configured = isGenerationConfigured;
  const fallbackPages: GeneratedPage[] = [
    {
      slug: "index",
      title: name,
      sections: [{ key: "overview", title: "Overview", body: brief || `A new site called "${name}".` }],
    },
  ];

  const { data: site, error } = await supabase
    .from("sites")
    .insert({
      user_id: user.id,
      name,
      brief: brief || null,
      badge_enabled: PLAN_LIMITS[plan].badge,
      pages: configured ? [] : fallbackPages,
      generation_status: configured ? "pending" : "validated",
      preferred_model: model,
    })
    .select("id")
    .single();

  if (error || !site) {
    return { error: error?.message ?? "Couldn't create the site." };
  }

  if (!configured) {
    await supabase.from("site_versions").insert({
      site_id: site.id,
      pages: fallbackPages,
      changed_sections: [],
      kind: "create",
    });
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/sites/${site.id}`);
}

/** Shared by manual edits and AI-generated ones: writes the new content and a version snapshot. */
async function writeSectionEdit(
  supabase: SupabaseClient<Database>,
  siteId: string,
  currentPages: GeneratedPage[],
  pageSlug: string,
  sectionKey: string,
  newBody: string
): Promise<{ error: string | null }> {
  const newPages = replaceSectionBody(currentPages, pageSlug, sectionKey, newBody);

  const { error: updateError } = await supabase
    .from("sites")
    .update({ pages: newPages })
    .eq("id", siteId);
  if (updateError) return { error: updateError.message };

  const { error: versionError } = await supabase.from("site_versions").insert({
    site_id: siteId,
    pages: newPages,
    changed_sections: [sectionRef(pageSlug, sectionKey)],
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
  pageSlug: string,
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
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, brief, pages, preferred_model")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (!site) return { error: "Site not found." };

  const plan = await getEffectivePlanForUser(user.id);

  const quotaError = await checkRebuildQuota(supabase, user.id, plan);
  if (quotaError) return { error: quotaError };

  const currentPages = site.pages as GeneratedPage[];
  const section = findSection(currentPages, pageSlug, sectionKey);
  if (!section) return { error: "Unknown section." };

  const { data: historyRows } = await supabase
    .from("site_messages")
    .select("role, content")
    .eq("site_id", siteId)
    .eq("page_slug", pageSlug)
    .eq("section_key", sectionKey)
    .order("created_at", { ascending: true });
  const history: ChatTurn[] = (historyRows ?? []).map((row) => ({ role: row.role, content: row.content }));

  const { error: userMessageError } = await supabase.from("site_messages").insert({
    site_id: siteId,
    page_slug: pageSlug,
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
    page_slug: pageSlug,
    section_key: sectionKey,
    role: "assistant",
    content: result.reply,
  });
  if (assistantMessageError) return { error: assistantMessageError.message };

  if (result.body !== section.body) {
    const { error: writeError } = await writeSectionEdit(
      supabase,
      siteId,
      currentPages,
      pageSlug,
      sectionKey,
      result.body
    );
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
    .select("pages, design_tokens")
    .eq("id", versionId)
    .eq("site_id", siteId)
    .single();
  if (!version) return { error: "Version not found." };

  // Tokens are restored alongside pages: a snapshot taken before a design
  // change should bring that design back with it, not leave the old copy
  // sitting under the new palette.
  const { error: updateError } = await supabase
    .from("sites")
    .update({ pages: version.pages, design_tokens: version.design_tokens })
    .eq("id", siteId);
  if (updateError) return { error: updateError.message };

  const { error: versionError } = await supabase.from("site_versions").insert({
    site_id: siteId,
    pages: version.pages,
    design_tokens: version.design_tokens,
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
