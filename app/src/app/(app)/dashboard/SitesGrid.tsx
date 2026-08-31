"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { GenerationStatus } from "@/lib/supabase/types";
import type { ChangeLogEntry } from "@/lib/generation/types";
import { deleteSite } from "./actions";
import { DeleteSiteButton } from "./DeleteSiteButton";

export interface SiteSummary {
  id: string;
  name: string;
  brief: string | null;
  badge_enabled: boolean;
  generation_status: GenerationStatus;
  published_at: string | null;
  subdomain: string | null;
  change_log: ChangeLogEntry[] | null;
}

/** Minutes/hours/days-ago, coarse on purpose — a dashboard card doesn't need
 * second-level precision, just enough to answer "is this stale?" at a
 * glance. Falls back to a short date past 30 days, same as most feeds. */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The most recent real activity on a site — its last change-log entry, or
 * (for a site with no edits yet) nothing. No separate `updated_at` column
 * exists on `sites`, and adding one just for this would be schema change
 * for data the change log already has. */
function lastActivity(changeLog: ChangeLogEntry[] | null): string | null {
  const last = changeLog?.[changeLog.length - 1];
  return last ? timeAgo(last.timestamp) : null;
}

// A few deterministic abstract "page" thumbnails so a grid of sites doesn't
// look like the same card repeated — picked by a stable hash of the site id,
// not randomly, so a card doesn't visually shuffle between renders.
const THUMBS = [
  <>
    <rect x="10" y="10" width="80" height="16" rx="3" fill="#2A2A31" />
    <rect x="10" y="34" width="60" height="8" rx="2" fill="#1A1A1F" />
    <rect x="10" y="48" width="80" height="30" rx="4" stroke="#3B82F6" />
  </>,
  <>
    <circle cx="30" cy="30" r="16" stroke="#3B82F6" />
    <rect x="54" y="18" width="36" height="8" rx="2" fill="#2A2A31" />
    <rect x="54" y="32" width="28" height="6" rx="2" fill="#1A1A1F" />
    <rect x="10" y="58" width="80" height="20" rx="4" fill="#1A1A1F" />
  </>,
  <>
    <rect x="10" y="10" width="24" height="68" rx="4" stroke="#2A2A31" />
    <rect x="40" y="10" width="24" height="68" rx="4" stroke="#3B82F6" />
    <rect x="70" y="10" width="20" height="68" rx="4" stroke="#2A2A31" />
  </>,
];

function hashToIndex(id: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % mod;
}

// How long the exit transition (in globals.css's .list-card-exit) actually
// takes — the refresh that removes the card from the server list is delayed
// by this much so it doesn't yank the DOM node away mid-animation.
const EXIT_MS = 200;

export function SitesGrid({ sites }: { sites: SiteSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Landing here via the sidebar's Search link/Cmd+K (from another page,
  // where there's no #site-search element yet to focus directly) should
  // still end with real keyboard focus in the box, not just a scroll.
  useEffect(() => {
    if (window.location.hash === "#site-search") {
      document.getElementById("site-search")?.focus();
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.brief ?? "").toLowerCase().includes(q)
    );
  }, [sites, query]);

  function handleDelete(id: string) {
    setRemovingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const result = await deleteSite(id);
      if (result.error) {
        toast.error(result.error);
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }
      // Let the exit transition actually finish before the server-refreshed
      // list arrives without this card — otherwise the fade is cut short by
      // React reconciling it straight out of the DOM.
      setTimeout(() => router.refresh(), EXIT_MS);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-mono uppercase tracking-wide text-ink-faint">
          Your sites <span className="text-ink-faint">({sites.length})</span>
        </h2>
        {sites.length > 0 && (
          <input
            id="site-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sites…"
            className="field-transition w-48 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        )}
      </div>

      {sites.length === 0 ? (
        <p className="text-sm text-ink-dim">No sites yet — create your first one above.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-dim">No sites match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((site, i) => {
            const isReady = site.generation_status === "validated";
            const activity = lastActivity(site.change_log);
            return (
              <div
                key={site.id}
                className="list-card-exit hover-lift fade-in-up relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface transition-colors hover:border-ink-faint"
                data-removing={removingIds.has(site.id)}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="absolute top-2 right-2 z-10">
                  <DeleteSiteButton
                    onConfirm={() => handleDelete(site.id)}
                    disabled={isPending && removingIds.has(site.id)}
                  />
                </div>
                <Link href={`/dashboard/sites/${site.id}`} className="press flex flex-1 flex-col">
                  <div className="flex items-center justify-center border-b border-hairline bg-surface-2/50 p-4">
                    <svg viewBox="0 0 100 88" fill="none" className="h-20 w-full" aria-hidden>
                      {THUMBS[hashToIndex(site.id, THUMBS.length)]}
                    </svg>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{site.name}</p>
                      {/* A site can be mid-build when you navigate back here, so
                          say so rather than showing a card that looks finished. */}
                      {site.generation_status === "pending" || site.generation_status === "generating" ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/50 bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase text-accent">
                          <span className="spinner" aria-hidden />
                          Building
                        </span>
                      ) : site.generation_status === "failed" ? (
                        <span className="shrink-0 rounded-full border border-red-900 bg-red-950/30 px-2 py-0.5 font-mono text-[10px] uppercase text-red-400">
                          Failed
                        </span>
                      ) : (
                        site.badge_enabled && (
                          <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] uppercase text-ink-faint">
                            Badge on
                          </span>
                        )
                      )}
                    </div>
                    {site.brief && <p className="line-clamp-2 text-sm text-ink-dim">{site.brief}</p>}
                  </div>
                </Link>

                {/* Publish status, last activity, and one-click shortcuts —
                    a sibling of the Link (not nested inside it) since an
                    anchor can't contain other interactive elements. */}
                {isReady && (
                  <div className="flex items-center justify-between gap-2 border-t border-hairline-soft px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                      {site.published_at ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden />
                          Live
                        </span>
                      ) : (
                        <span className="shrink-0">Draft</span>
                      )}
                      {activity && <span className="truncate">· {activity}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <a
                        href={`/preview/${site.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="press font-semibold text-ink-dim transition-colors hover:text-white"
                      >
                        Preview
                      </a>
                      <Link
                        href={`/dashboard/sites/${site.id}#publish`}
                        className="press font-semibold text-accent transition-colors hover:text-accent-hover"
                      >
                        {site.published_at ? "Manage" : "Publish"}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
