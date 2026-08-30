"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { publishSite, unpublishSite, type PublishState } from "./publish-actions";

const initialState: PublishState = { error: null };

export function PublishPanel({
  siteId,
  subdomain,
  suggested,
  isPublished,
  hasUnpublishedChanges,
  publishedUrl,
  rootDomain,
}: {
  siteId: string;
  subdomain: string | null;
  suggested: string;
  isPublished: boolean;
  hasUnpublishedChanges: boolean;
  publishedUrl: string | null;
  rootDomain: string | null;
}) {
  const [publishState, publishAction, isPublishing] = useActionState(
    publishSite.bind(null, siteId),
    initialState
  );
  const [unpublishState, unpublishAction, isUnpublishing] = useActionState(
    unpublishSite.bind(null, siteId),
    initialState
  );
  const [address, setAddress] = useState(subdomain ?? suggested);

  useEffect(() => {
    if (publishState.error) toast.error(publishState.error);
    else if (publishState.success) toast.success("Site published.");
  }, [publishState]);

  useEffect(() => {
    if (unpublishState.error) toast.error(unpublishState.error);
    else if (unpublishState.success) toast.success("Site taken offline.");
  }, [unpublishState]);

  return (
    <section className="fade-in-up mb-8 rounded-2xl border border-hairline bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-mono uppercase tracking-wide text-ink-faint">Publish</h2>
        {isPublished ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-900 bg-green-950/30 px-2.5 py-0.5 font-mono text-[10px] uppercase text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden />
            Live
          </span>
        ) : (
          <span className="rounded-full border border-hairline px-2.5 py-0.5 font-mono text-[10px] uppercase text-ink-faint">
            Draft
          </span>
        )}
      </div>

      {isPublished && publishedUrl && (
        <p className="mb-3 text-sm">
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            {publishedUrl}
          </a>
        </p>
      )}

      {/* Publishing snapshots the draft, so an edit made after publishing
          isn't live until it's published again — say so rather than letting
          someone assume their change already shipped. */}
      {isPublished && hasUnpublishedChanges && (
        <p className="mb-3 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-white">
          You&rsquo;ve edited this site since it was published. Visitors still see the last published
          version — publish again to push your changes live.
        </p>
      )}

      <form action={publishAction} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="subdomain"
            className="mb-1 block text-xs font-mono uppercase tracking-wide text-ink-faint"
          >
            Address
          </label>
          <div className="flex items-center gap-1">
            <input
              id="subdomain"
              name="subdomain"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
              className="field-transition min-w-0 flex-1 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
            <span className="shrink-0 font-mono text-xs text-ink-faint">
              {rootDomain ? `.${rootDomain}` : "/s/…"}
            </span>
          </div>
        </div>
        <button
          type="submit"
          disabled={isPublishing}
          className="press rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {isPublishing ? "Publishing…" : isPublished ? "Publish changes" : "Publish"}
        </button>
      </form>

      <p className="mt-2 text-xs text-ink-faint">
        Lowercase letters, numbers and hyphens. Your address is unique across Francisity.
      </p>

      {isPublished && (
        <form action={unpublishAction} className="mt-3 border-t border-hairline-soft pt-3">
          <button
            type="submit"
            disabled={isUnpublishing}
            className="press text-xs text-ink-faint underline underline-offset-2 transition-colors hover:text-white disabled:opacity-60"
          >
            {isUnpublishing ? "Taking offline…" : "Take offline"}
          </button>
        </form>
      )}
    </section>
  );
}
