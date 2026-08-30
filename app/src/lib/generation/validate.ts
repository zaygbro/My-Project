// Real, deterministic checks run against the FULL generated project on
// every pass (build-prompt point 1: "every fix must be validated against
// the FULL current project state, not just the single error it was meant
// to solve"). Nothing here is cosmetic — each check catches something that
// would actually break or look broken for a real visitor.

import type { DesignTokens, GeneratedPage, GenerationOutput, StructuredBrief, ValidationIssue } from "./types";

/** Layouts that only say something a plain paragraph doesn't when they carry
 * real items — matches site-content.ts's sanitizeSection, which falls back
 * to "text" below these same minimums. Flagging it here (rather than only
 * falling back silently at render time) gives the fix pass a chance to
 * actually supply the items instead of the site quietly losing the layout
 * the model said it wanted. */
const MIN_ITEMS: Partial<Record<NonNullable<GeneratedPage["sections"][number]["layout"]>, number>> = {
  stats: 2,
  features: 2,
  list: 1,
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const GENERIC_FILLER = [
  /lorem ipsum/i,
  /your content here/i,
  /coming soon/i,
  /\btodo\b/i,
  /placeholder text/i,
  /insert .* here/i,
];
const MARKDOWN_LINK = /\[[^\]]+\]\((\/[a-z0-9-]*)\)/gi;

function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA) + 0.05;
  const l2 = relativeLuminance(hexB) + 0.05;
  return Math.max(l1, l2) / Math.min(l1, l2);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateTokens(tokens: DesignTokens, issues: ValidationIssue[]): void {
  for (const [name, value] of Object.entries(tokens.colors)) {
    if (!HEX_COLOR.test(value)) {
      issues.push({
        severity: "error",
        code: "invalid-color",
        message: `Design token colors.${name} is not a valid 6-digit hex color: "${value}"`,
      });
    }
  }
  if (issues.some((i) => i.code === "invalid-color")) return; // can't check contrast on invalid hex

  const textContrast = contrastRatio(tokens.colors.text, tokens.colors.background);
  if (textContrast < 4.5) {
    issues.push({
      severity: "error",
      code: "low-contrast-text",
      message: `text on background is ${textContrast.toFixed(2)}:1 — below the 4.5:1 WCAG AA minimum.`,
    });
  }
  const mutedContrast = contrastRatio(tokens.colors.textMuted, tokens.colors.background);
  if (mutedContrast < 4.5) {
    issues.push({
      severity: "error",
      code: "low-contrast-muted",
      message: `textMuted on background is ${mutedContrast.toFixed(2)}:1 — below the 4.5:1 WCAG AA minimum.`,
    });
  }
}

function validatePages(brief: StructuredBrief, pages: GeneratedPage[], issues: ValidationIssue[]): void {
  const seenSlugs = new Set<string>();
  for (const page of pages) {
    if (seenSlugs.has(page.slug)) {
      issues.push({ severity: "error", code: "duplicate-slug", message: `Duplicate page slug: "${page.slug}"` });
    }
    seenSlugs.add(page.slug);

    if (page.sections.length === 0) {
      issues.push({ severity: "error", code: "empty-page", message: `Page "${page.slug}" has no sections.` });
      continue;
    }

    for (const section of page.sections) {
      const body = section.body.trim();
      if (!body) {
        issues.push({
          severity: "error",
          code: "empty-section",
          message: `Section "${section.key}" on page "${page.slug}" has an empty body.`,
        });
        continue;
      }
      for (const pattern of GENERIC_FILLER) {
        if (pattern.test(body)) {
          issues.push({
            severity: "error",
            code: "generic-filler",
            message: `Section "${section.key}" on page "${page.slug}" contains generic filler text ("${pattern.source}") instead of real brief-specific copy.`,
          });
          break;
        }
      }
      const minItems = section.layout ? MIN_ITEMS[section.layout] : undefined;
      if (minItems !== undefined && (section.items?.length ?? 0) < minItems) {
        issues.push({
          severity: "error",
          code: "missing-section-items",
          message: `Section "${section.key}" on page "${page.slug}" is a "${section.layout}" layout but has ${section.items?.length ?? 0} item(s) — needs at least ${minItems}.`,
        });
      }

      for (const match of body.matchAll(MARKDOWN_LINK)) {
        const targetSlug = match[1].replace(/^\//, "") || "index";
        if (!seenSlugs.has(targetSlug) && !pages.some((p) => p.slug === targetSlug)) {
          issues.push({
            severity: "error",
            code: "broken-internal-link",
            message: `Section "${section.key}" on page "${page.slug}" links to "/${targetSlug}", which isn't a generated page.`,
          });
        }
      }
    }
  }

  // Every must-have page from the brief needs a real generated counterpart —
  // matched by slug, not by trusting the model said it made one.
  for (const required of brief.mustHavePages) {
    const requiredSlug = slugify(required);
    if (!pages.some((p) => p.slug === requiredSlug)) {
      issues.push({
        severity: "error",
        code: "missing-required-page",
        message: `Brief requires a "${required}" page (slug "${requiredSlug}") but none was generated.`,
      });
    }
  }
}

export function validateProject(brief: StructuredBrief, output: GenerationOutput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  validateTokens(output.tokens, issues);
  validatePages(brief, output.pages, issues);
  return issues;
}

export { slugify };
