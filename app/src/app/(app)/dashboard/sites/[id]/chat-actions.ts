"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getEffectivePlanForUser } from "@/lib/dev-mode";
import { checkRebuildQuota } from "../../actions";
import { chatEditProject, isGenerationConfigured } from "@/lib/generation/generate";
import { deriveMustHavePages, SITE_CHAT_PAGE_SLUG, SITE_CHAT_SECTION_KEY } from "@/lib/site-content";
import type { ChangeLogEntry, ChatTurn, DesignTokens, GeneratedPage, ProjectState, StructuredBrief } from "@/lib/generation/types";

export interface SendSiteMessageState {
  error: string | null;
  success?: boolean;
  reply?: string;
}

/**
 * One turn of the single, whole-site AI chat. Unlike the old per-section
 * chat (which scoped every message to one section box you had to find and
 * click into), the model here sees the entire site and decides for itself
 * which section(s) to touch — see chatEditProject.
 */
export async function sendSiteMessage(
  siteId: string,
  _prevState: SendSiteMessageState,
  formData: FormData
): Promise<SendSiteMessageState> {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Message can't be empty." };

  if (!isGenerationConfigured) {
    return { error: "AI generation isn't configured yet — set ANTHROPIC_API_KEY." };
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, brief, pages, design_tokens, preferred_model, generation_status, total_cost_usd, change_log")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (!site) return { error: "Site not found." };

  if (site.generation_status !== "validated") {
    return { error: "This site hasn't finished building yet." };
  }

  const plan = await getEffectivePlanForUser(user.id);
  const quotaError = await checkRebuildQuota(supabase, user.id, plan);
  if (quotaError) return { error: quotaError };

  const { data: historyRows } = await supabase
    .from("site_messages")
    .select("role, content")
    .eq("site_id", siteId)
    .eq("page_slug", SITE_CHAT_PAGE_SLUG)
    .eq("section_key", SITE_CHAT_SECTION_KEY)
    .order("created_at", { ascending: true });
  const history: ChatTurn[] = (historyRows ?? []).map((row) => ({ role: row.role, content: row.content }));

  const { error: userMessageError } = await supabase.from("site_messages").insert({
    site_id: siteId,
    page_slug: SITE_CHAT_PAGE_SLUG,
    section_key: SITE_CHAT_SECTION_KEY,
    role: "user",
    content: message,
  });
  if (userMessageError) return { error: userMessageError.message };

  // Rebuilt fresh from the raw brief text every time, same as
  // generation-actions.ts does — there's no separately stored
  // StructuredBrief, so this is the one place that derivation happens, and
  // it's already deterministic (same text in, same mustHavePages out).
  const briefText = site.brief ?? "";
  const brief: StructuredBrief = {
    mustHavePages: deriveMustHavePages(briefText),
    freeformNotes: briefText || `A site called "${site.name}".`,
  };
  const state: ProjectState = {
    brief,
    model: site.preferred_model,
    tokens: site.design_tokens as DesignTokens | null,
    pages: site.pages as GeneratedPage[],
    changeLog: (site.change_log ?? []) as ChangeLogEntry[],
    status: "validated",
    totalCostUsd: site.total_cost_usd ?? 0,
  };

  let result;
  try {
    result = await chatEditProject(state, history, message);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI response failed." };
  }

  const { error: assistantMessageError } = await supabase.from("site_messages").insert({
    site_id: siteId,
    page_slug: SITE_CHAT_PAGE_SLUG,
    section_key: SITE_CHAT_SECTION_KEY,
    role: "assistant",
    content: result.reply,
  });
  if (assistantMessageError) return { error: assistantMessageError.message };

  const hasRealChange = result.changedRefs.length > 0 || result.tokensChanged;
  if (hasRealChange) {
    const { error: updateError } = await supabase
      .from("sites")
      .update({
        pages: result.projectState.pages,
        design_tokens: result.projectState.tokens,
        change_log: result.projectState.changeLog,
        total_cost_usd: result.projectState.totalCostUsd,
      })
      .eq("id", siteId);
    if (updateError) return { error: updateError.message };

    const { error: versionError } = await supabase.from("site_versions").insert({
      site_id: siteId,
      pages: result.projectState.pages,
      design_tokens: result.projectState.tokens,
      changed_sections: result.tokensChanged ? [...result.changedRefs, "design"] : result.changedRefs,
      kind: "edit",
    });
    if (versionError) return { error: versionError.message };
  } else {
    // A question or a no-op turn still burned real tokens and belongs in
    // the log/cost, even though there's no new content to snapshot.
    await supabase
      .from("sites")
      .update({ change_log: result.projectState.changeLog, total_cost_usd: result.projectState.totalCostUsd })
      .eq("id", siteId);
  }

  revalidatePath(`/dashboard/sites/${siteId}`);
  // The dedicated chat+preview editor is a separate route (outside
  // /dashboard, so it can use the full viewport instead of the dashboard
  // shell's capped-width main column) — it needs its own revalidation to
  // pick up the new change_log entry that remounts its preview iframe.
  revalidatePath(`/sites/${siteId}/edit`);
  return { error: null, success: true, reply: result.reply };
}
