"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { sanitizeTokens } from "@/lib/site-theme";
import { contrastRatio } from "@/lib/generation/validate";
import type { DesignTokens } from "@/lib/generation/types";

export interface UpdateTokensState {
  error: string | null;
  success?: boolean;
}

const MIN_CONTRAST = 4.5;

/**
 * Direct token editing, no AI call — the owner picks exact values instead
 * of describing a change and hoping the model lands on it. Re-validated
 * exactly like the generation pipeline does: a malformed color/font falls
 * back to a safe default (sanitizeTokens, same function the render path
 * uses) rather than getting written as-is, and a contrast failure is
 * rejected outright rather than silently saved unreadable — the owner
 * picked these values on purpose, so they get told why it didn't take
 * instead of the site quietly getting harder to read.
 */
export async function updateDesignTokens(
  siteId: string,
  _prevState: UpdateTokensState,
  formData: FormData
): Promise<UpdateTokensState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const requested: DesignTokens = {
    colors: {
      background: String(formData.get("background") ?? ""),
      surface: String(formData.get("surface") ?? ""),
      text: String(formData.get("text") ?? ""),
      textMuted: String(formData.get("textMuted") ?? ""),
      accent: String(formData.get("accent") ?? ""),
    },
    fonts: {
      display: String(formData.get("display") ?? ""),
      body: String(formData.get("body") ?? ""),
    },
    radius: String(formData.get("radius") ?? ""),
  };

  const safe = sanitizeTokens(requested);
  const textContrast = contrastRatio(safe.colors.text, safe.colors.background);
  if (textContrast < MIN_CONTRAST) {
    return { error: `Text on background is only ${textContrast.toFixed(2)}:1 — needs at least ${MIN_CONTRAST}:1 to stay readable. Pick a color with more contrast.` };
  }
  const mutedContrast = contrastRatio(safe.colors.textMuted, safe.colors.background);
  if (mutedContrast < MIN_CONTRAST) {
    return { error: `Muted text on background is only ${mutedContrast.toFixed(2)}:1 — needs at least ${MIN_CONTRAST}:1 to stay readable. Pick a color with more contrast.` };
  }

  const tokens: DesignTokens = {
    colors: safe.colors,
    fonts: { display: safe.displayFont, body: safe.bodyFont },
    radius: safe.radius,
  };

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, pages, generation_status")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (!site) return { error: "Site not found." };
  if (site.generation_status !== "validated") return { error: "This site hasn't finished building yet." };

  const { error: updateError } = await supabase.from("sites").update({ design_tokens: tokens }).eq("id", siteId);
  if (updateError) return { error: updateError.message };

  const { error: versionError } = await supabase.from("site_versions").insert({
    site_id: siteId,
    pages: site.pages,
    design_tokens: tokens,
    changed_sections: ["design"],
    kind: "edit",
  });
  if (versionError) return { error: versionError.message };

  revalidatePath(`/dashboard/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/edit`);
  return { error: null, success: true };
}
