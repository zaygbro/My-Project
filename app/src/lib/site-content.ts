// Helpers for working with a site's `pages` — the single source of truth for
// site content since 0006_multipage_generation.sql. Pure functions, so they
// are unit-testable without a database or an API key.

import type { GeneratedPage, PageSection } from "@/lib/generation/types";

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
      if (!beforeSection || beforeSection.body !== section.body || beforeSection.title !== section.title) {
        refs.push(sectionRef(page.slug, section.key));
      }
    }
  }
  return refs;
}
