// Helpers for working with a site's `pages` — the single source of truth for
// site content since 0006_multipage_generation.sql. Pure functions, so they
// are unit-testable without a database or an API key.

import { SECTION_LAYOUTS, type GeneratedPage, type PageSection, type SectionItem, type SectionLayout } from "@/lib/generation/types";

/** A single-page brief shouldn't be padded out to three pages just because
 * that's the common default. Deterministic (no AI call) in the same spirit
 * as deriveNameFromBrief — the model still decides what goes ON each page,
 * this only decides how many pages the brief is asking for. */
const SINGLE_PAGE_HINTS =
  /\b(landing\s*page|one[-\s]?pager?|one[-\s]?page|single[-\s]?page|coming[-\s]?soon)\b/i;

/** Sentinel `page_slug`/`section_key` values for the single, site-wide AI
 * chat's rows in `site_messages` — not a real page or section, so a leading
 * underscore keeps them unambiguous against real slugs, which are always
 * lowercase-hyphenated with no leading underscore. Shared here so the writer
 * (chat-actions.ts) and reader (the site page's query) can't drift apart. */
export const SITE_CHAT_PAGE_SLUG = "_site";
export const SITE_CHAT_SECTION_KEY = "_chat";

export const DEFAULT_PAGES = ["Home", "About", "Contact"];
export const SINGLE_PAGE = ["Home"];

export function deriveMustHavePages(brief: string): string[] {
  return SINGLE_PAGE_HINTS.test(brief) ? [...SINGLE_PAGE] : [...DEFAULT_PAGES];
}

/** Stable identifier for one section within a site, since a section key is
 * only unique within its page ("intro" can exist on both Home and About). */
export function sectionRef(pageSlug: string, sectionKey: string): string {
  return `${pageSlug}/${sectionKey}`;
}

export function findSection(
  pages: GeneratedPage[],
  pageSlug: string,
  sectionKey: string
): PageSection | undefined {
  return pages.find((p) => p.slug === pageSlug)?.sections.find((s) => s.key === sectionKey);
}

/** Returns a new `pages` array with one section's body replaced. Structural
 * sharing is deliberate but immutability is not optional here — the caller
 * writes the result to the database while still holding the original for a
 * version snapshot, so mutating in place would corrupt both. */
export function replaceSectionBody(
  pages: GeneratedPage[],
  pageSlug: string,
  sectionKey: string,
  body: string
): GeneratedPage[] {
  return pages.map((page) =>
    page.slug !== pageSlug
      ? page
      : {
          ...page,
          sections: page.sections.map((section) =>
            section.key === sectionKey ? { ...section, body } : section
          ),
        }
  );
}

/** Which sections actually changed between one version of a site's pages and
 * the next — used to label a version-history entry and to decide whether a
 * chat turn produced a real edit at all (an empty result means the model
 * only asked a question, or a "change" that left every body identical).
 *
 * Only detects additions and modifications, not removals — a section
 * present in `before` but missing from `after` doesn't get a ref, since
 * there is no live `sectionRef` for a section that no longer exists. That's
 * an acceptable gap for what this feeds (an informational label in Version
 * History), not something anything else depends on. */
export function diffChangedSections(before: GeneratedPage[], after: GeneratedPage[]): string[] {
  const refs: string[] = [];
  for (const page of after) {
    const beforePage = before.find((p) => p.slug === page.slug);
    for (const section of page.sections) {
      const beforeSection = beforePage?.sections.find((s) => s.key === section.key);
      if (
        !beforeSection ||
        beforeSection.body !== section.body ||
        beforeSection.title !== section.title ||
        beforeSection.layout !== section.layout ||
        beforeSection.attribution !== section.attribution ||
        JSON.stringify(beforeSection.items) !== JSON.stringify(section.items)
      ) {
        refs.push(sectionRef(page.slug, section.key));
      }
    }
  }
  return refs;
}

/** A section as it's actually safe to render: `layout` narrowed to a real,
 * known value (defaulting to "text" — what every section rendered as before
 * layouts existed, and what an unrecognized or missing value should still
 * fall back to), and `items`/`attribution` only populated when the layout
 * actually uses them. Sections come from a language model and are rendered
 * to the public, so this is checked here rather than trusted — the same
 * posture site-theme.ts's sanitizeTokens takes with design tokens. */
export interface SafeSection {
  key: string;
  title: string;
  body: string;
  layout: SectionLayout;
  items: SectionItem[];
  attribution: string | null;
}

const LAYOUTS_NEEDING_ITEMS: SectionLayout[] = ["stats", "features", "list"];
/** Below this many real items, the layout can't say anything a plain
 * paragraph doesn't already — a single "stat" isn't a comparison, so it
 * falls back to "text" rather than rendering a lopsided one-item grid. */
const MIN_ITEMS: Partial<Record<SectionLayout, number>> = { stats: 2, features: 2, list: 1 };

export function sanitizeSection(section: PageSection): SafeSection {
  const layout: SectionLayout = SECTION_LAYOUTS.includes(section.layout as SectionLayout)
    ? (section.layout as SectionLayout)
    : "text";

  const items = Array.isArray(section.items)
    ? section.items
        .filter((item): item is SectionItem => typeof item?.label === "string" && item.label.trim().length > 0)
        .map((item) => ({
          label: item.label.trim(),
          detail: typeof item.detail === "string" && item.detail.trim() ? item.detail.trim() : undefined,
        }))
    : [];

  if (LAYOUTS_NEEDING_ITEMS.includes(layout) && items.length < (MIN_ITEMS[layout] ?? 1)) {
    return { key: section.key, title: section.title, body: section.body, layout: "text", items: [], attribution: null };
  }

  const attribution =
    layout === "quote" && typeof section.attribution === "string" && section.attribution.trim()
      ? section.attribution.trim()
      : null;

  return {
    key: section.key,
    title: section.title,
    body: section.body,
    layout,
    items: LAYOUTS_NEEDING_ITEMS.includes(layout) ? items : [],
    attribution,
  };
}
