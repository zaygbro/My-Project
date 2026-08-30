"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { generateProject, isGenerationConfigured } from "@/lib/generation/generate";
import { deriveMustHavePages } from "@/lib/site-content";
import type { ChangeLogEntry, StructuredBrief } from "@/lib/generation/types";
import type { GenerationStatus } from "@/lib/supabase/types";

export interface GenerationSnapshot {
  status: GenerationStatus;
  changeLog: ChangeLogEntry[];
  error: string | null;
}

/**
 * Runs the real generation pipeline for a site that's waiting on one.
 *
 * Claiming the job is a conditional update (`pending` -> `generating`) rather
 * than a read-then-write: that's what makes it safe to call from a component
 * that can mount twice (React Strict Mode) or from two tabs at once. Only the
 * update that actually matched `pending` gets a row back; every other caller
 * sees no row and returns without spending a second run's worth of tokens.
 */
export async function startGeneration(siteId: string): Promise<GenerationSnapshot> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!isGenerationConfigured) {
    await supabase
      .from("sites")
      .update({
        generation_status: "failed",
        generation_error: "AI generation isn't configured yet — set ANTHROPIC_API_KEY.",
      })
      .eq("id", siteId)
      .eq("user_id", user.id);
    revalidatePath(`/dashboard/sites/${siteId}`);
    return {
      status: "failed",
      changeLog: [],
      error: "AI generation isn't configured yet — set ANTHROPIC_API_KEY.",
    };
  }

  const { data: claimed } = await supabase
    .from("sites")
    .update({ generation_status: "generating", generation_error: null, change_log: [] })
    .eq("id", siteId)
    .eq("user_id", user.id)
    .eq("generation_status", "pending")
    .select("id, name, brief, preferred_model")
    .maybeSingle();

  if (!claimed) {
    // Already running, already finished, or not ours — report whatever the
    // current truth is instead of starting a duplicate run.
    return getGenerationStatus(siteId);
  }

  const briefText = claimed.brief ?? "";
  const brief: StructuredBrief = {
    mustHavePages: deriveMustHavePages(briefText),
    freeformNotes: briefText || `A site called "${claimed.name}".`,
  };

  // Persist each stage as it happens so the build screen shows real progress
  // (generating -> validating -> fixing) rather than one opaque wait.
  const persistProgress = async (entry: ChangeLogEntry) => {
    const { data: row } = await supabase
      .from("sites")
      .select("change_log")
      .eq("id", siteId)
      .maybeSingle();
    const log = (row?.change_log ?? []) as ChangeLogEntry[];
    await supabase
      .from("sites")
      .update({ change_log: [...log, entry] })
      .eq("id", siteId);
  };

  try {
    const result = await generateProject(brief, claimed.preferred_model, persistProgress);

    await supabase
      .from("sites")
      .update({
        pages: result.pages,
        design_tokens: result.tokens,
        change_log: result.changeLog,
        total_cost_usd: result.totalCostUsd,
        generation_status: result.status,
        generation_error:
          result.status === "failed"
            ? "The generated site failed validation twice in a row, so it stopped instead of retrying. See the build log for exactly what was wrong."
            : null,
      })
      .eq("id", siteId);

    // Seed version history with the generated result, so "roll back to when
    // this was built" is available from the very first edit onward.
    if (result.status === "validated") {
      await supabase.from("site_versions").insert({
        site_id: siteId,
        pages: result.pages,
        design_tokens: result.tokens,
        changed_sections: [],
        kind: "create",
      });
    }

    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
    return {
      status: result.status,
      changeLog: result.changeLog,
      error: result.status === "failed" ? "Failed validation twice in a row." : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    await supabase
      .from("sites")
      .update({ generation_status: "failed", generation_error: message })
      .eq("id", siteId);
    revalidatePath(`/dashboard/sites/${siteId}`);
    return { status: "failed", changeLog: [], error: message };
  }
}

/** Lightweight poll target for the build screen. */
export async function getGenerationStatus(siteId: string): Promise<GenerationSnapshot> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { data: site } = await supabase
    .from("sites")
    .select("generation_status, generation_error, change_log")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!site) return { status: "failed", changeLog: [], error: "Site not found." };

  return {
    status: site.generation_status,
    changeLog: (site.change_log ?? []) as ChangeLogEntry[],
    error: site.generation_error,
  };
}

/**
 * Puts a site back to `pending` so startGeneration can claim it again.
 *
 * Reclaims a `generating` row too, not just a `failed` one: a run lives
 * inside a server action, so a closed tab or a killed serverless invocation
 * can leave a site stuck on `generating` with nothing left to finish it.
 * Without this, that site would poll forever. `validated` is deliberately
 * excluded — a finished site must never be clobbered by a stray retry.
 */
export async function retryGeneration(siteId: string): Promise<GenerationSnapshot> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  await supabase
    .from("sites")
    .update({ generation_status: "pending", generation_error: null, change_log: [] })
    .eq("id", siteId)
    .eq("user_id", user.id)
    .neq("generation_status", "validated");

  return startGeneration(siteId);
}
