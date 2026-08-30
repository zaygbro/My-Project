import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS } from "@/lib/plans";
import { UpgradeButton } from "../../BillingButtons";
import { getMonthlyEditCount } from "@/lib/quota";
import type { ChangeLogEntry, ChatTurn, DesignTokens, GeneratedPage } from "@/lib/generation/types";
import { isGenerationConfigured } from "@/lib/generation/generate";
import { SiteChat } from "./SiteChat";
import { LivePreview } from "./LivePreview";
import { ModelSettingsForm } from "./ModelSettingsForm";
import { RestoreVersionButton } from "./RestoreVersionButton";
import { DangerZone } from "./DangerZone";
import { BuildProgress } from "./BuildProgress";
import { RebuildBanner } from "./RebuildBanner";
import { PublishPanel } from "./PublishPanel";
import { publishedUrl, suggestSubdomain } from "@/lib/publish";
import { getModelInfo } from "@/lib/ai/models";
import { getEffectivePlanForUser } from "@/lib/dev-mode";
import { SITE_CHAT_PAGE_SLUG, SITE_CHAT_SECTION_KEY } from "@/lib/site-content";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sevenDaysAgoISO(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export default async function SiteDetailPage(props: PageProps<"/dashboard/sites/[id]">) {
  const { id } = await props.params;

  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!site) notFound();

  // `generation_status` is NOT NULL in the schema, so null/undefined here can
  // only mean the column isn't there — the migration hasn't been applied to
  // this database. Without this check the code below reads `undefined`,
  // which isn't "validated", so it falls through to a build screen that can
  // never start, poll, or finish: it just sits on "Done / Loading your
  // site…" forever. Failing loudly with the actual cause beats hanging.
  if (site.generation_status == null) {
    return (
      <div className="fade-in-up">
        <Link
          href="/dashboard"
          className="mb-6 inline-block font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-white"
        >
          ← Dashboard
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{site.name}</h1>
        <div className="mt-4 rounded-xl border border-amber-900 bg-amber-950/20 p-5">
          <p className="text-sm font-semibold text-amber-300">This database is missing the generation schema.</p>
          <p className="mt-2 text-sm text-neutral-400">
            This site has no <code className="font-mono text-neutral-300">generation_status</code>, which means
            the newer migrations haven&rsquo;t been run yet. Apply{" "}
            <code className="font-mono text-neutral-300">0006_multipage_generation.sql</code> and{" "}
            <code className="font-mono text-neutral-300">0007_publishing.sql</code> from{" "}
            <code className="font-mono text-neutral-300">app/supabase/migrations/</code> in the Supabase SQL
            editor, then reload this page.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Until then, building and publishing sites can&rsquo;t work — the columns they read and write
            don&rsquo;t exist.
          </p>
        </div>
      </div>
    );
  }

  // A site that's still building (or failed) has no pages, versions, or chat
  // history to render yet — show the live build screen instead of an empty
  // shell, and skip the queries that would all come back empty anyway.
  if (site.generation_status !== "validated") {
    return (
      <div>
        <Link
          href="/dashboard"
          className="mb-6 inline-block font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-white"
        >
          ← Dashboard
        </Link>
        <header className="fade-in-up mb-6">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{site.name}</h1>
          {site.brief && <p className="mt-1 text-sm text-ink-dim">{site.brief}</p>}
        </header>
        <BuildProgress
          siteId={site.id}
          initialStatus={site.generation_status}
          initialChangeLog={(site.change_log ?? []) as ChangeLogEntry[]}
          initialError={site.generation_error}
          initialPages={(site.pages ?? []) as GeneratedPage[]}
          initialTokens={site.design_tokens as DesignTokens | null}
        />
        <DangerZone siteId={site.id} />
      </div>
    );
  }

  const [plan, { data: versions }, { count: totalViews }, { count: recentViews }, { data: messages }] =
    await Promise.all([
      getEffectivePlanForUser(user.id),
      supabase
        .from("site_versions")
        .select("*")
        .eq("site_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("site_events").select("id", { count: "exact", head: true }).eq("site_id", id),
      supabase
        .from("site_events")
        .select("id", { count: "exact", head: true })
        .eq("site_id", id)
        .gte("occurred_at", sevenDaysAgoISO()),
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

  const pages = site.pages as GeneratedPage[];
  const tokens = site.design_tokens as DesignTokens | null;
  const hasTraffic = (totalViews ?? 0) > 0;
  const modelInfo = getModelInfo(site.preferred_model);

  const isPublished = site.published_at !== null;
  // Publishing snapshots the draft, so "has unpublished changes" is a real
  // comparison between what's live and what's current — not a flag someone
  // has to remember to set.
  const hasUnpublishedChanges =
    isPublished && JSON.stringify(site.published_pages) !== JSON.stringify(pages);
  const rootDomain = process.env.NEXT_PUBLIC_PUBLISH_ROOT_DOMAIN?.trim() || null;
  const appOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const liveUrl =
    isPublished && site.subdomain ? publishedUrl(site.subdomain, appOrigin) : null;

  return (
    <div>
      <Link href="/dashboard" className="mb-6 inline-block font-mono text-xs uppercase tracking-wide text-ink-faint hover:text-white">
        ← Dashboard
      </Link>

      <header className="fade-in-up mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{site.name}</h1>
            {site.brief && <p className="mt-1 text-sm text-ink-dim">{site.brief}</p>}
          </div>
          {PLAN_LIMITS[plan].exportEnabled ? (
            <a
              href={`/api/sites/${site.id}/export`}
              className="press rounded-full border border-hairline bg-surface-2 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-ink-dim"
            >
              Export to code
            </a>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-faint">Export to code is a Pro feature</span>
              <UpgradeButton plan="pro" period="monthly" label="Upgrade to Pro" />
            </div>
          )}
        </header>

        {/* A site that finished generating always has design tokens, so their
            absence is a reliable marker for one that predates the pipeline
            (or was wrapped by the 0006 backfill) and is still a placeholder. */}
        {tokens === null && <RebuildBanner siteId={site.id} />}

        {/* Chat + live preview, side by side — the same shape BuildProgress
            already uses (chat/log on the left, the real site on the right),
            just with a chat that can change anything instead of a log of
            what's already happened. The layout doesn't change once a build
            finishes; only what's in the left pane does. */}
        <div
          className="fade-in-up mb-8 grid gap-6 lg:h-[75vh] lg:min-h-[560px] lg:grid-cols-[300px_1fr]"
          style={{ animationDelay: "20ms" }}
        >
          <div className="flex flex-col lg:min-h-0">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h2 className="text-sm font-mono uppercase tracking-wide text-ink-faint">
                {isGenerationConfigured ? `Chat with ${modelInfo.label}` : "AI chat"}
              </h2>
              <span className="font-mono text-xs text-ink-faint">
                {rebuildLimit === null ? "Unlimited" : `${rebuildsUsed}/${rebuildLimit} used`}
              </span>
            </div>
            {isGenerationConfigured ? (
              <div className="lg:min-h-0 lg:flex-1">
                <SiteChat
                  siteId={site.id}
                  modelLabel={modelInfo.label}
                  disabled={atRebuildLimit}
                  initialMessages={chatMessages}
                />
              </div>
            ) : (
              <p className="rounded-2xl border border-hairline bg-surface p-5 text-sm text-ink-faint">
                AI generation isn&rsquo;t configured yet — set{" "}
                <code className="font-mono text-ink-dim">ANTHROPIC_API_KEY</code> to chat with{" "}
                {modelInfo.label} about this site.
              </p>
            )}
            {atRebuildLimit && (
              <p className="mt-3 shrink-0 text-sm text-accent">
                You&rsquo;ve used all your rebuilds for this month on {PLAN_LABELS[plan]} — upgrade for
                unlimited rebuilds.
              </p>
            )}
          </div>

          <div className="flex flex-col lg:min-h-0">
            <p className="mb-3 shrink-0 font-mono text-xs uppercase tracking-wide text-ink-faint">Preview</p>
            <div className="lg:min-h-0 lg:flex-1">
              <LivePreview
                pages={pages}
                tokens={tokens}
                openInNewTabHref={`/preview/${site.id}`}
                scrollClassName="max-h-[70vh] overflow-y-auto lg:max-h-none lg:flex-1"
              />
            </div>
          </div>
        </div>

        <PublishPanel
          siteId={site.id}
          subdomain={site.subdomain}
          suggested={suggestSubdomain(site.name)}
          isPublished={isPublished}
          hasUnpublishedChanges={hasUnpublishedChanges}
          publishedUrl={liveUrl}
          rootDomain={rootDomain}
        />

        {/* Analytics */}
        <section
          className="fade-in-up mb-8 rounded-2xl border border-hairline bg-surface p-5"
          style={{ animationDelay: "40ms" }}
        >
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-ink-faint">Analytics</h2>
          {hasTraffic ? (
            <div className="flex gap-8">
              <div>
                <p className="font-display text-2xl font-extrabold tabular-nums">{totalViews}</p>
                <p className="text-xs text-ink-faint">All-time views</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold tabular-nums">{recentViews}</p>
                <p className="text-xs text-ink-faint">Last 7 days</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">
              {isPublished
                ? "No visits recorded yet — this counts real views of your published site."
                : "No visits yet. Publish this site to start recording real traffic."}
            </p>
          )}
        </section>

        {/* Design tokens — the "visual engine" half of what generation
            produced, and the palette the export actually renders with. */}
        {tokens && (
          <section
            className="fade-in-up mb-8 rounded-2xl border border-hairline bg-surface p-5"
            style={{ animationDelay: "60ms" }}
          >
            <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-ink-faint">Design</h2>
            <div className="flex flex-wrap items-start gap-6">
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">Palette</p>
                <div className="flex gap-2">
                  {Object.entries(tokens.colors).map(([name, hex]) => (
                    <div key={name} className="text-center">
                      <span
                        className="block h-9 w-9 rounded-lg border border-hairline"
                        style={{ backgroundColor: hex }}
                        title={`${name}: ${hex}`}
                      />
                      <span className="mt-1 block font-mono text-[9px] text-ink-faint">{hex}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">Type</p>
                <p className="text-sm text-ink-dim">{tokens.fonts.display}</p>
                <p className="text-sm text-ink-faint">{tokens.fonts.body}</p>
              </div>
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">Radius</p>
                <p className="font-mono text-sm text-ink-dim">{tokens.radius}</p>
              </div>
            </div>
          </section>
        )}

        {/* AI model */}
        <section className="fade-in-up mb-8" style={{ animationDelay: "120ms" }}>
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-ink-faint">
            AI model for this site
          </h2>
          {isGenerationConfigured ? (
            <ModelSettingsForm siteId={site.id} current={site.preferred_model} />
          ) : (
            <p className="text-sm text-ink-faint">
              AI generation isn&rsquo;t configured yet — currently set to {modelInfo.label} for when it is.
            </p>
          )}
        </section>

        {/* Version history */}
        <section className="fade-in-up" style={{ animationDelay: "160ms" }}>
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-ink-faint">Version history</h2>
          <ul className="space-y-2">
            {(versions ?? []).map((version, i) => (
              <li
                key={version.id}
                className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm">
                    <span className="font-mono text-xs uppercase text-accent">{version.kind}</span>
                    {version.changed_sections.length > 0 && (
                      <span className="ml-2 text-ink-dim">{version.changed_sections.join(", ")}</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-faint">{formatDate(version.created_at)}</p>
                </div>
                {i !== 0 && <RestoreVersionButton siteId={site.id} versionId={version.id} />}
              </li>
            ))}
          </ul>
        </section>

        <DangerZone siteId={site.id} />
    </div>
  );
}
