import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS } from "@/lib/plans";
import { getMonthlyEditCount } from "@/lib/quota";
import { getEffectivePlanForUser } from "@/lib/dev-mode";
import { getModelInfo } from "@/lib/ai/models";
import { isGenerationConfigured } from "@/lib/generation/generate";
import { SITE_CHAT_PAGE_SLUG, SITE_CHAT_SECTION_KEY } from "@/lib/site-content";
import type { ChangeLogEntry, ChatTurn, DesignTokens, GeneratedPage } from "@/lib/generation/types";
import { EditorPreview } from "./EditorPreview";
import { EditorSidebar } from "./EditorSidebar";

/**
 * The full chat+site editing experience, on its own page instead of a
 * cramped split-pane inside the dashboard's capped-width main column — a
 * real edit session needs the room a sidebar and a max-w-4xl wrapper both
 * take away. Deliberately NOT under /dashboard (which would inherit that
 * shell); auth is checked here directly instead, the same way /preview/[id]
 * (also outside /dashboard for the same reason) checks it.
 */
export default async function SiteEditPage(props: PageProps<"/sites/[id]/edit">) {
  const { id } = await props.params;

  const user = await getCurrentUser();
  if (!user) notFound();

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, name, generation_status, preferred_model, change_log, pages, design_tokens")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!site || site.generation_status !== "validated") notFound();

  const [plan, { data: messages }] = await Promise.all([
    getEffectivePlanForUser(user.id),
    supabase
      .from("site_messages")
      .select("role, content")
      .eq("site_id", id)
      .eq("page_slug", SITE_CHAT_PAGE_SLUG)
      .eq("section_key", SITE_CHAT_SECTION_KEY)
      .order("created_at", { ascending: true }),
  ]);

  const chatMessages: ChatTurn[] = (messages ?? []).map((m) => ({ role: m.role, content: m.content }));
  const rebuildLimit = PLAN_LIMITS[plan].rebuildLimit;
  const rebuildsUsed = rebuildLimit !== null ? await getMonthlyEditCount(supabase, user.id) : 0;
  const atRebuildLimit = rebuildLimit !== null && rebuildsUsed >= rebuildLimit;
  const modelInfo = getModelInfo(site.preferred_model);
  // Remounting the iframe is what makes it reload — a plain src change on an
  // already-mounted iframe doesn't force a fresh navigation the way a new
  // `key` does. change_log grows by at least one entry every real edit (see
  // chat-actions.ts), so its length is a simple, always-available "this
  // site's content just changed" signal without adding a dedicated column.
  const previewKey = ((site.change_log as ChangeLogEntry[] | null) ?? []).length;

  return (
    <div className="flex h-screen flex-col bg-background text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline bg-surface px-6 py-3">
        <Link
          href={`/dashboard/sites/${id}`}
          className="press font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-white"
        >
          ← {site.name}
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/sites/${id}#history`}
            className="press hidden font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-white sm:inline"
          >
            History
          </Link>
          <Link
            href={`/dashboard/sites/${id}#publish`}
            className="press rounded-full border border-hairline px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-white transition-colors hover:border-accent"
          >
            Publish
          </Link>
          <a
            href={`/preview/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="press font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-white"
          >
            Open in new tab ↗
          </a>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[420px_1fr]">
        <EditorSidebar
          siteId={site.id}
          modelLabel={modelInfo.label}
          isGenerationConfigured={isGenerationConfigured}
          chatDisabled={atRebuildLimit}
          atRebuildLimit={atRebuildLimit}
          rebuildLimit={rebuildLimit}
          rebuildsUsed={rebuildsUsed}
          planLabel={PLAN_LABELS[plan]}
          initialMessages={chatMessages}
          pages={site.pages as GeneratedPage[]}
          tokens={site.design_tokens as DesignTokens | null}
        />

        <EditorPreview siteId={site.id} siteName={site.name} previewKey={previewKey} />
      </div>
    </div>
  );
}
