"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { DesignTokens, GeneratedPage } from "@/lib/generation/types";

export interface SectionActionState {
  error: string | null;
  success?: boolean;
}

/** Loads a site's own pages/tokens, scoped to the caller — every action
 * below needs this same ownership-checked read before it can touch
 * anything, so it's factored out rather than repeated four times. */
type LoadedSite =
  | { ok: false; error: string }
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; pages: GeneratedPage[]; tokens: DesignTokens | null };

async function loadOwnedSite(siteId: string): Promise<LoadedSite> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, pages, design_tokens, generation_status")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .single();
  if (!site) return { ok: false, error: "Site not found." };
  if (site.generation_status !== "validated") return { ok: false, error: "This site hasn't finished building yet." };

  return { ok: true, supabase, pages: site.pages as GeneratedPage[], tokens: site.design_tokens as DesignTokens | null };
}

/** Writes the updated pages back, snapshots a version (same "every real
 * structural change gets a version" rule chat edits and rollbacks follow),
 * and revalidates both places a change needs to show up. */
async function persist(
  siteId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  pages: GeneratedPage[],
  tokens: DesignTokens | null,
  changedRef: string
): Promise<SectionActionState> {
  const { error: updateError } = await supabase.from("sites").update({ pages }).eq("id", siteId);
  if (updateError) return { error: updateError.message };

  const { error: versionError } = await supabase.from("site_versions").insert({
    site_id: siteId,
    pages,
    design_tokens: tokens,
    changed_sections: [changedRef],
    kind: "edit",
  });
  if (versionError) return { error: versionError.message };

  revalidatePath(`/dashboard/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/edit`);
  return { error: null, success: true };
}

function findPageIndex(pages: GeneratedPage[], pageSlug: string): number {
  return pages.findIndex((p) => p.slug === pageSlug);
}

/**
 * Reorders one section within its page — a structural move, not a content
 * edit, so it never touches an AI model. Swaps with its immediate neighbor
 * rather than taking an arbitrary target index: simpler to reason about,
 * and "move up/down" is the only reordering interaction the editor offers.
 */
export async function moveSection(
  siteId: string,
  pageSlug: string,
  sectionKey: string,
  direction: "up" | "down",
  _prevState: SectionActionState,
  _formData: FormData
): Promise<SectionActionState> {
  const loaded = await loadOwnedSite(siteId);
  if (!loaded.ok) return { error: loaded.error };
  const { supabase, pages, tokens } = loaded;

  const pageIndex = findPageIndex(pages, pageSlug);
  if (pageIndex === -1) return { error: "Page not found." };
  const sections = pages[pageIndex].sections;
  const sectionIndex = sections.findIndex((s) => s.key === sectionKey);
  if (sectionIndex === -1) return { error: "Section not found." };

  const targetIndex = direction === "up" ? sectionIndex - 1 : sectionIndex + 1;
  if (targetIndex < 0 || targetIndex >= sections.length) {
    // Already at the edge — a no-op, not an error the owner needs to see.
    return { error: null, success: true };
  }

  const nextSections = [...sections];
  [nextSections[sectionIndex], nextSections[targetIndex]] = [nextSections[targetIndex], nextSections[sectionIndex]];
  const nextPages = pages.map((p, i) => (i === pageIndex ? { ...p, sections: nextSections } : p));

  return persist(siteId, supabase, nextPages, tokens, `${pageSlug}/${sectionKey}`);
}

/** A duplicated section needs its own key — real content pages don't check
 * key uniqueness elsewhere in the pipeline, so a collision would make two
 * sections share one DOM id and one edit target. Suffixed with a short
 * random tag rather than a counter to avoid a second collision if the
 * duplicate is itself duplicated. */
function uniqueKey(baseKey: string, existing: Set<string>): string {
  let candidate = `${baseKey}-copy`;
  while (existing.has(candidate)) {
    candidate = `${baseKey}-copy-${Math.random().toString(36).slice(2, 6)}`;
  }
  return candidate;
}

export async function duplicateSection(
  siteId: string,
  pageSlug: string,
  sectionKey: string,
  _prevState: SectionActionState,
  _formData: FormData
): Promise<SectionActionState> {
  const loaded = await loadOwnedSite(siteId);
  if (!loaded.ok) return { error: loaded.error };
  const { supabase, pages, tokens } = loaded;

  const pageIndex = findPageIndex(pages, pageSlug);
  if (pageIndex === -1) return { error: "Page not found." };
  const sections = pages[pageIndex].sections;
  const sectionIndex = sections.findIndex((s) => s.key === sectionKey);
  if (sectionIndex === -1) return { error: "Section not found." };

  const existingKeys = new Set(sections.map((s) => s.key));
  const copy = { ...sections[sectionIndex], key: uniqueKey(sectionKey, existingKeys) };
  const nextSections = [...sections.slice(0, sectionIndex + 1), copy, ...sections.slice(sectionIndex + 1)];
  const nextPages = pages.map((p, i) => (i === pageIndex ? { ...p, sections: nextSections } : p));

  return persist(siteId, supabase, nextPages, tokens, `${pageSlug}/${copy.key}`);
}

export async function deleteSection(
  siteId: string,
  pageSlug: string,
  sectionKey: string,
  _prevState: SectionActionState,
  _formData: FormData
): Promise<SectionActionState> {
  const loaded = await loadOwnedSite(siteId);
  if (!loaded.ok) return { error: loaded.error };
  const { supabase, pages, tokens } = loaded;

  const pageIndex = findPageIndex(pages, pageSlug);
  if (pageIndex === -1) return { error: "Page not found." };
  const sections = pages[pageIndex].sections;
  if (sections.length <= 1) {
    return { error: "A page needs at least one section — edit it instead of removing the last one." };
  }
  const nextSections = sections.filter((s) => s.key !== sectionKey);
  if (nextSections.length === sections.length) return { error: "Section not found." };
  const nextPages = pages.map((p, i) => (i === pageIndex ? { ...p, sections: nextSections } : p));

  return persist(siteId, supabase, nextPages, tokens, `${pageSlug}/${sectionKey}`);
}
