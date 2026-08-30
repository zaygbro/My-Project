"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { regenerateSite } from "./generation-actions";

/**
 * Offered on sites that were never really generated — the ones holding a
 * single placeholder "Overview" section from before the pipeline existed.
 * Confirmed before running, because it replaces the site's current content
 * (recoverably: the existing version stays in history).
 */
export function RebuildBanner({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, start] = useTransition();

  function rebuild() {
    start(async () => {
      const result = await regenerateSite(siteId);
      if (result.status === "failed" && result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="fade-in-up mb-8 rounded-2xl border border-accent/40 bg-accent-soft p-5">
      <h2 className="text-sm font-semibold text-accent">This site was never really generated</h2>
      <p className="mt-1.5 text-sm text-ink-dim">
        It holds a single placeholder section from before Francisity could build multi-page sites, which is
        why there&rsquo;s no design or page structure here. Rebuilding runs your brief through the real
        pipeline — structure, copy, design tokens, and validation.
      </p>

      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-dim">
            Replace this site&rsquo;s current content? The version you have now stays in history.
          </span>
          <button
            type="button"
            onClick={rebuild}
            disabled={isPending}
            className="press rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              {isPending && <span className="spinner" aria-hidden />}
              {isPending ? "Rebuilding…" : "Yes, rebuild"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="press rounded-full border border-hairline px-4 py-2 text-sm text-ink-dim disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="press mt-3 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
        >
          Rebuild with AI
        </button>
      )}
    </section>
  );
}
