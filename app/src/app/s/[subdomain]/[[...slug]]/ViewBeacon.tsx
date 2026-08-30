"use client";

import { useEffect, useRef } from "react";

/**
 * Records one view of a published page.
 *
 * This is the caller /api/track was written for and never had — with it,
 * `site_events` finally receives real rows, which is what makes the
 * per-site and platform analytics panels show real numbers instead of an
 * honest zero.
 *
 * Deliberately fire-and-forget: analytics must never block rendering, and a
 * failed beacon must never surface an error to a visitor who isn't the
 * site's owner and can't act on it.
 */
export function ViewBeacon({ siteId, path }: { siteId: string; path: string }) {
  // The page is cached and can re-render on client navigation between pages
  // of the same site; this ref keeps one mount to one recorded view.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const body = JSON.stringify({ site_id: siteId, path });

    // sendBeacon survives the page being closed mid-request, which a normal
    // fetch does not — a visitor who bounces immediately still counts.
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Nothing useful to tell a visitor about a failed analytics ping.
    });
  }, [siteId, path]);

  return null;
}
