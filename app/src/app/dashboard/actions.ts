"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";
import { getMonthlyEditCount } from "@/lib/quota";
import { isAiModelId, recommendModel, type AiModelId } from "@/lib/ai/models";
import { isGenerationConfigured } from "@/lib/generation/generate";
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

  // No key means nothing can be generated, and a site builder that can't
  // build isn't usable. This used to seed a placeholder "Overview" section
  // holding the raw brief, which looked like a finished site but was really
  // just the user's own words handed back — say what's actually wrong
  // instead of manufacturing content.
  if (!isGenerationConfigured) {
    return { error: "AI generation isn't configured yet — set ANTHROPIC_API_KEY to build sites." };
  }

  // The site row is created empty and `pending`: the real multi-page
  // generation runs from the site's own page, which streams its progress.
  // Creating a site therefore returns immediately instead of blocking this
  // action (and the user's tab) on a 20-60s model call that might fail.
  const { data: site, error } = await supabase
    .from("sites")
    .insert({
      user_id: user.id,
      name,
      brief: brief || null,
      badge_enabled: PLAN_LIMITS[plan].badge,
      pages: [],
      generation_status: "pending",
      preferred_model: model,
    })
    .select("id")
    .single();

  if (error || !site) {
    return { error: error?.message ?? "Couldn't create the site." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/sites/${site.id}`);
}

/** Shared by every path that can consume rebuild quota — the site-wide AI
 * chat (chat-actions.ts) included, so there's one definition of "at your
 * limit" rather than two that could drift. */
export async function checkRebuildQuota(
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

export interface DeleteSiteState {
  error: string | null;
  success?: boolean;
}

/** Deleting the row cascades: site_versions, site_messages, and site_events
 * all reference sites with `on delete cascade` (see 0001/0002/0004), so
 * there's nothing else to clean up manually. The subdomain it held becomes
 * free to reuse the moment the row is gone. The `.eq("user_id", ...)`
 * mirrors RLS rather than relying on it silently. */
export async function deleteSite(siteId: string): Promise<DeleteSiteState> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { error, count } = await supabase
    .from("sites")
    .delete({ count: "exact" })
    .eq("id", siteId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  if (!count) return { error: "Site not found." };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/sites/${siteId}`);
  return { error: null, success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
