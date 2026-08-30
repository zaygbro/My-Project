import type { PageSection } from "@/lib/generation/types";

/** Read-only display of one section's content. Editing happens through the
 * single site-wide SiteChat, not a per-section chat box here anymore. */
export function SectionEditor({ section }: { section: PageSection }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
      <p className="mb-2 text-xs font-mono uppercase tracking-wide text-neutral-500">{section.title}</p>
      <p className="whitespace-pre-wrap text-sm text-neutral-300">{section.body}</p>
    </div>
  );
}
