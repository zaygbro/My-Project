"use client";

import { useState, type CSSProperties } from "react";
import type { DesignTokens, GeneratedPage } from "@/lib/generation/types";

/**
 * Live view of a site while it's being generated, reusing the exact
 * `.preview-frame` / `.preview-surface` system in globals.css that was
 * originally built for the unwired new-build prototype — a generated
 * project renders with ITS OWN tokens via CSS custom properties, not the
 * dashboard's fixed black/blue theme, since every generated site should
 * look distinct.
 *
 * `pages`/`tokens` can update mid-render as the pipeline's draft callback
 * fires (see generation-actions.ts's persistDraft) — this component just
 * renders whatever it's handed, with no opinion about whether a run is
 * still in progress.
 */
export function LivePreview({
  pages,
  tokens,
  scrollClassName = "max-h-[70vh] overflow-y-auto",
  openInNewTabHref,
}: {
  pages: GeneratedPage[];
  tokens: DesignTokens | null;
  /** Overrides the scrollable content area's height/overflow — the
   * dedicated full-page preview passes `flex-1 overflow-y-auto` so it fills
   * the viewport instead of the compact split-pane cap. */
  scrollClassName?: string;
  /** Shows the browser-chrome "open in new tab" button pointing here.
   * Omitted while a site is still generating — there's no stable route to
   * open yet, only an in-memory draft. */
  openInNewTabHref?: string;
}) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  if (!tokens || pages.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-800 p-8 text-center">
        <span className="spinner" aria-hidden />
        <p className="max-w-xs text-sm text-neutral-500">
          Nothing to show yet — the structural and visual engines are still drafting the first version.
        </p>
      </div>
    );
  }

  // Derived, not stored: if a fix pass changes which pages exist, a stale
  // selection just falls back to the first page rather than needing an
  // effect to notice and correct it.
  const activeSlug = pages.some((p) => p.slug === selectedSlug) ? (selectedSlug as string) : pages[0].slug;
  const activePage = pages.find((p) => p.slug === activeSlug) ?? pages[0];

  const frameStyle = {
    "--preview-bg": tokens.colors.background,
    "--preview-surface": tokens.colors.surface,
    "--preview-text": tokens.colors.text,
    "--preview-text-muted": tokens.colors.textMuted,
    "--preview-accent": tokens.colors.accent,
    "--preview-font-display": tokens.fonts.display,
    "--preview-font-body": tokens.fonts.body,
    "--preview-radius": tokens.radius,
  } as CSSProperties;

  return (
    <div>
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(
          tokens.fonts.display
        )}:wght@700&family=${encodeURIComponent(tokens.fonts.body)}:wght@400;500&display=swap`}
      />
      <div className="preview-frame overflow-hidden rounded-2xl border border-neutral-800" style={frameStyle}>
        <div className="flex items-center justify-between gap-2 border-b border-black/10 bg-black/5 px-3 py-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
          </div>
          {openInNewTabHref && (
            <a
              href={openInNewTabHref}
              target="_blank"
              rel="noopener noreferrer"
              className="press preview-muted flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-black/10"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 3h6v6M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Open in new tab
            </a>
          )}
        </div>
        {pages.length > 1 && (
          <div className="flex gap-1 overflow-x-auto border-b border-black/10 bg-black/5 p-2">
            {pages.map((page, i) => (
              <button
                key={`${page.slug}-${i}`}
                type="button"
                onClick={() => setSelectedSlug(page.slug)}
                className={`press shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page.slug === activeSlug ? "preview-accent-bg text-white" : "hover:bg-black/5"
                }`}
              >
                {page.title}
              </button>
            ))}
          </div>
        )}
        <div className={`${scrollClassName} space-y-4 p-6`}>
          {activePage.sections.length === 0 ? (
            <p className="preview-muted text-sm">This page&rsquo;s copy hasn&rsquo;t been drafted yet.</p>
          ) : (
            activePage.sections.map((section) => (
              <div key={section.key} className="preview-surface p-5">
                <h3 className="mb-2 text-lg font-bold">{section.title}</h3>
                <p className="preview-muted whitespace-pre-wrap text-sm">{section.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
