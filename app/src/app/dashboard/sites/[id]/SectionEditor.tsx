"use client";

import type { PageSection } from "@/lib/generation/types";
import { SectionChat } from "./SectionChat";
import type { ChatTurn } from "@/lib/ai/generate";

export function SectionEditor({
  siteId,
  pageSlug,
  section,
  disabled,
  aiConfigured,
  modelLabel,
  initialMessages,
}: {
  siteId: string;
  pageSlug: string;
  section: PageSection;
  disabled: boolean;
  aiConfigured: boolean;
  modelLabel: string;
  initialMessages: ChatTurn[];
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
      <p className="mb-2 text-xs font-mono uppercase tracking-wide text-neutral-500">{section.title}</p>
      <p className="whitespace-pre-wrap text-sm text-neutral-300">{section.body}</p>

      {aiConfigured ? (
        <SectionChat
          siteId={siteId}
          pageSlug={pageSlug}
          sectionKey={section.key}
          modelLabel={modelLabel}
          disabled={disabled}
          initialMessages={initialMessages}
        />
      ) : (
        <p className="mt-4 text-xs text-neutral-600">AI generation isn&rsquo;t configured yet.</p>
      )}
    </div>
  );
}
