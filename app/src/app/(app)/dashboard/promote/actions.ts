"use server";

import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { writeAdScript, isPromoteConfigured, type AdScript } from "@/lib/promote/generate";
import { isPlatformId } from "@/lib/promote/platforms";
import { publishedUrl } from "@/lib/publish";
import type { DesignTokens, GeneratedPage } from "@/lib/generation/types";

export interface WriteAdState {
  error: string | null;
  script?: AdScript;
  siteId?: string;
  platform?: string;
}

export async function writeAd(
  _prevState: WriteAdState,
  formData: FormData
): Promise<WriteAdState> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!isPromoteConfigured) {
    return { error: "AI isn't configured yet — set ANTHROPIC_API_KEY." };
  }

  const siteId = String(formData.get("siteId") ?? "");
  const platform = String(formData.get("platform") ?? "");
  if (!siteId) return { error: "Pick a site to advertise." };
  if (!isPlatformId(platform)) return { error: "Pick where the ad is going." };

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, brief, pages, design_tokens, preferred_model, subdomain, published_at, generation_status")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (!site) return { error: "Site not found." };

  // An ad is written from the site's real copy, so there has to be some.
  if (site.generation_status !== "validated" || site.pages.length === 0) {
    return { error: "That site hasn't finished building yet." };
  }

  const siteUrl =
    site.published_at && site.subdomain
      ? publishedUrl(site.subdomain, process.env.NEXT_PUBLIC_SITE_URL ?? "")
      : null;

  try {
    const script = await writeAdScript({
      model: site.preferred_model,
      platform,
      siteName: site.name,
      siteBrief: site.brief,
      pages: site.pages as GeneratedPage[],
      tokens: site.design_tokens as DesignTokens | null,
      siteUrl,
    });
    return { error: null, script, siteId, platform };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't write the ad." };
  }
}
