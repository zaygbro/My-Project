"use client";

import { useState } from "react";
import { SiteChat } from "@/app/(app)/dashboard/sites/[id]/SiteChat";
import { SectionManager } from "@/app/(app)/dashboard/sites/[id]/SectionManager";
import { DesignPanel } from "@/app/(app)/dashboard/sites/[id]/DesignPanel";
import type { ChatTurn, DesignTokens, GeneratedPage } from "@/lib/generation/types";

type Tab = "chat" | "sections" | "design";

const TABS: { id: Tab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "sections", label: "Sections" },
  { id: "design", label: "Design" },
];

/**
 * The editor's left column, as tabs rather than three stacked panels — a
 * chat, a section list, and a token form all competing for the same narrow
 * column would each be too cramped to actually use. Chat stays the default:
 * it's the one every session starts in.
 */
export function EditorSidebar({
  siteId,
  modelLabel,
  isGenerationConfigured,
  chatDisabled,
  atRebuildLimit,
  rebuildLimit,
  rebuildsUsed,
  planLabel,
  initialMessages,
  pages,
  tokens,
}: {
  siteId: string;
  modelLabel: string;
  isGenerationConfigured: boolean;
  chatDisabled: boolean;
  atRebuildLimit: boolean;
  rebuildLimit: number | null;
  rebuildsUsed: number;
  planLabel: string;
  initialMessages: ChatTurn[];
  pages: GeneratedPage[];
  tokens: DesignTokens | null;
}) {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div role="tablist" aria-label="Editor panel" className="flex shrink-0 gap-1 rounded-full border border-hairline bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`press flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id ? "bg-accent text-white" : "text-ink-faint hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2" hidden={tab !== "chat"}>
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-sm font-mono uppercase tracking-wide text-ink-faint">
            {isGenerationConfigured ? `Chat with ${modelLabel}` : "AI chat"}
          </h2>
          <span className="font-mono text-xs text-ink-faint">
            {rebuildLimit === null ? "Unlimited" : `${rebuildsUsed}/${rebuildLimit} used`}
          </span>
        </div>
        {isGenerationConfigured ? (
          <div className="min-h-0 flex-1">
            <SiteChat siteId={siteId} modelLabel={modelLabel} disabled={chatDisabled} initialMessages={initialMessages} />
          </div>
        ) : (
          <p className="rounded-2xl border border-hairline bg-surface p-5 text-sm text-ink-faint">
            AI generation isn&rsquo;t configured yet — set{" "}
            <code className="font-mono text-ink-dim">ANTHROPIC_API_KEY</code> to chat with {modelLabel} about this
            site.
          </p>
        )}
        {atRebuildLimit && (
          <p className="shrink-0 text-sm text-accent">
            You&rsquo;ve used all your rebuilds for this month on {planLabel} — upgrade for unlimited rebuilds.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1" hidden={tab !== "sections"}>
        <SectionManager siteId={siteId} pages={pages} />
      </div>
      <div className="min-h-0 flex-1" hidden={tab !== "design"}>
        {tokens ? (
          <DesignPanel siteId={siteId} tokens={tokens} />
        ) : (
          <p className="rounded-2xl border border-hairline bg-surface p-5 text-sm text-ink-faint">
            This site has no design tokens yet.
          </p>
        )}
      </div>
    </div>
  );
}
