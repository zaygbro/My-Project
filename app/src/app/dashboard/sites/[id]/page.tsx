import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LABELS, PLAN_LIMITS, type PlanId } from "@/lib/plans";
import { UpgradeButton } from "../../BillingButtons";
import { getMonthlyEditCount } from "@/lib/quota";
import type { SiteSection } from "@/lib/supabase/types";
import { SectionEditor } from "./SectionEditor";
import { ModelSettingsForm } from "./ModelSettingsForm";
import { RestoreVersionButton } from "./RestoreVersionButton";
import { getModelInfo } from "@/lib/ai/models";
import { isAnthropicConfigured, type ChatTurn } from "@/lib/ai/generate";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!site) notFound();

  const [{ data: subscription }, { data: versions }, { count: totalViews }, { count: recentViews }, { data: messages }] =
    await Promise.all([
      supabase.from("subscriptions").select("plan").eq("user_id", user.id).single(),
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
        .select("section_key, role, content")
        .eq("site_id", id)
        .order("created_at", { ascending: true }),
    ]);

  const messagesBySection = new Map<string, ChatTurn[]>();
  for (const m of messages ?? []) {
    const turns = messagesBySection.get(m.section_key) ?? [];
    turns.push({ role: m.role, content: m.content });
    messagesBySection.set(m.section_key, turns);
  }

  const plan = (subscription?.plan ?? "spark") as PlanId;
  const rebuildLimit = PLAN_LIMITS[plan].rebuildLimit;
  const rebuildsUsed = rebuildLimit !== null ? await getMonthlyEditCount(supabase, user.id) : 0;
  const atRebuildLimit = rebuildLimit !== null && rebuildsUsed >= rebuildLimit;

  const content = site.content as SiteSection[];
  const hasTraffic = (totalViews ?? 0) > 0;
  const modelInfo = getModelInfo(site.preferred_model);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="mb-6 inline-block font-mono text-xs uppercase tracking-wide text-neutral-500 hover:text-white">
          ← Dashboard
        </Link>

        <header className="fade-in-up mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{site.name}</h1>
            {site.brief && <p className="mt-1 text-sm text-neutral-400">{site.brief}</p>}
          </div>
          {PLAN_LIMITS[plan].exportEnabled ? (
            <a
              href={`/api/sites/${site.id}/export`}
              className="press rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-neutral-500"
            >
              Export to code
            </a>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500">Export to code is a Pro feature</span>
              <UpgradeButton plan="pro" period="monthly" label="Upgrade to Pro" />
            </div>
          )}
        </header>

        {/* Analytics */}
        <section
          className="fade-in-up mb-8 rounded-xl border border-neutral-800 bg-neutral-950 p-5"
          style={{ animationDelay: "40ms" }}
        >
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-neutral-500">Analytics</h2>
          {hasTraffic ? (
            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-extrabold tabular-nums">{totalViews}</p>
                <p className="text-xs text-neutral-500">All-time views</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold tabular-nums">{recentViews}</p>
                <p className="text-xs text-neutral-500">Last 7 days</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              No visits recorded yet. This site isn&rsquo;t published to a live URL during private beta, so
              there&rsquo;s honestly nothing to show — this panel reads real event data and will populate once
              publishing is live.
            </p>
          )}
        </section>

        {/* Sections */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wide text-neutral-500">Sections</h2>
            <span className="font-mono text-xs text-neutral-500">
              {rebuildLimit === null ? "Unlimited rebuilds" : `${rebuildsUsed}/${rebuildLimit} rebuilds used this month`}
            </span>
          </div>
          <div className="space-y-4">
            {content.map((section, i) => (
              <div key={section.key} className="fade-in-up" style={{ animationDelay: `${80 + i * 50}ms` }}>
                <SectionEditor
                  siteId={site.id}
                  section={section}
                  disabled={atRebuildLimit}
                  aiConfigured={isAnthropicConfigured}
                  modelLabel={modelInfo.label}
                  initialMessages={messagesBySection.get(section.key) ?? []}
                />
              </div>
            ))}
          </div>
          {atRebuildLimit && (
            <p className="mt-3 text-sm text-blue-400">
              You&rsquo;ve used all your rebuilds for this month on {PLAN_LABELS[plan]} — upgrade for unlimited
              rebuilds.
            </p>
          )}
        </section>

        {/* AI model */}
        <section className="fade-in-up mb-8" style={{ animationDelay: "120ms" }}>
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-neutral-500">
            AI model for this site
          </h2>
          {isAnthropicConfigured ? (
            <ModelSettingsForm siteId={site.id} current={site.preferred_model} />
          ) : (
            <p className="text-sm text-neutral-500">
              AI generation isn&rsquo;t configured yet — currently set to {modelInfo.label} for when it is.
            </p>
          )}
        </section>

        {/* Version history */}
        <section className="fade-in-up" style={{ animationDelay: "160ms" }}>
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-neutral-500">Version history</h2>
          <ul className="space-y-2">
            {(versions ?? []).map((version, i) => (
              <li
                key={version.id}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3"
              >
                <div>
                  <p className="text-sm">
                    <span className="font-mono text-xs uppercase text-blue-500">{version.kind}</span>
                    {version.changed_sections.length > 0 && (
                      <span className="ml-2 text-neutral-400">{version.changed_sections.join(", ")}</span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500">{formatDate(version.created_at)}</p>
                </div>
                {i !== 0 && <RestoreVersionButton siteId={site.id} versionId={version.id} />}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
