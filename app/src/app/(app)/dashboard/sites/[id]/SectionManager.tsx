"use client";

import { useState } from "react";
import type { GeneratedPage } from "@/lib/generation/types";
import { SectionRow } from "./SectionRow";

/**
 * Structural editing without an AI call — reorder, duplicate, or remove a
 * section directly. The page picker is independent of whatever path the
 * preview iframe currently shows (there's no live sync between them), which
 * keeps this simple: pick a page here, act on its sections, and the
 * preview picks up the change on its next reload regardless of which page
 * it happens to be showing.
 */
export function SectionManager({ siteId, pages }: { siteId: string; pages: GeneratedPage[] }) {
  const [pageSlug, setPageSlug] = useState(pages[0]?.slug ?? "");
  const page = pages.find((p) => p.slug === pageSlug) ?? pages[0];

  if (!page) {
    return <p className="p-4 text-sm text-ink-faint">This site has no pages yet.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 rounded-2xl border border-hairline bg-background p-3">
      {pages.length > 1 && (
        <select
          value={page.slug}
          onChange={(e) => setPageSlug(e.target.value)}
          className="field-transition w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        >
          {pages.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title}
            </option>
          ))}
        </select>
      )}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {page.sections.map((section, i) => (
          <SectionRow
            key={section.key}
            siteId={siteId}
            pageSlug={page.slug}
            section={section}
            isFirst={i === 0}
            isLast={i === page.sections.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
