"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export interface SiteSummary {
  id: string;
  name: string;
  brief: string | null;
  badge_enabled: boolean;
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

export function SitesGrid({ sites }: { sites: SiteSummary[] }) {
  const [query, setQuery] = useState("");

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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-mono uppercase tracking-wide text-neutral-500">
          Your sites <span className="text-neutral-700">({sites.length})</span>
        </h2>
        {sites.length > 0 && (
          <input
            id="site-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sites…"
            className="field-transition w-48 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        )}
      </div>

      {sites.length === 0 ? (
        <p className="text-sm text-neutral-500">No sites yet — create your first one above.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">No sites match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((site, i) => (
            <Link
              key={site.id}
              href={`/dashboard/sites/${site.id}`}
              className="hover-lift press fade-in-up flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 transition-colors hover:border-neutral-600"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center justify-center border-b border-neutral-800 bg-neutral-900/50 p-4">
                <svg viewBox="0 0 100 88" fill="none" className="h-20 w-full" aria-hidden>
                  {THUMBS[hashToIndex(site.id, THUMBS.length)]}
                </svg>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{site.name}</p>
                  {site.badge_enabled && (
                    <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 font-mono text-[10px] uppercase text-neutral-500">
                      Badge on
                    </span>
                  )}
                </div>
                {site.brief && <p className="line-clamp-2 text-sm text-neutral-500">{site.brief}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
