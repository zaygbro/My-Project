"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { generateProject, isGenerationConfigured } from "@/lib/generation/generate";
import { isAiModelId, type AiModelId } from "@/lib/ai/models";
import type { ProjectState, StructuredBrief } from "@/lib/generation/types";

export interface RunGenerationState {
  error: string | null;
  result?: ProjectState;
}

function splitLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitCommas(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function runGeneration(
  _prevState: RunGenerationState,
  formData: FormData
): Promise<RunGenerationState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  if (!isGenerationConfigured) {
    return { error: "AI generation isn't configured yet — set ANTHROPIC_API_KEY." };
  }

  const industry = String(formData.get("industry") ?? "").trim();
  const tone = String(formData.get("tone") ?? "").trim();
  const mustHavePages = splitCommas(formData.get("mustHavePages"));
  if (!industry || !tone || mustHavePages.length === 0) {
    return { error: "Industry, tone, and at least one must-have page are required." };
  }

  const modelRaw = String(formData.get("model") ?? "");
  const model: AiModelId = isAiModelId(modelRaw) ? modelRaw : "claude-haiku-4-5";

  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const logoDescription = String(formData.get("logoDescription") ?? "").trim();
  const references = splitLines(formData.get("references"));
  const freeformNotes = String(formData.get("freeformNotes") ?? "").trim();

  const brief: StructuredBrief = {
    industry,
    tone,
    mustHavePages,
    brandAssets:
      primaryColor || logoDescription
        ? { primaryColor: primaryColor || undefined, logoDescription: logoDescription || undefined }
        : undefined,
    references: references.length > 0 ? references : undefined,
    freeformNotes: freeformNotes || undefined,
  };

  try {
    const result = await generateProject(brief, model);
    return { error: null, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed." };
  }
}
