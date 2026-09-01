"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { moveSection, duplicateSection, deleteSection, type SectionActionState } from "./section-actions";
import type { PageSection } from "@/lib/generation/types";

const initial: SectionActionState = { error: null };

function IconButton({
  label,
  disabled,
  onClick,
  submit,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  /** True inside a <form action={...}> — clicking submits that form instead
   * of running onClick. */
  submit?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={submit ? "submit" : "button"}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="press flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline text-ink-dim transition-colors hover:border-ink-faint hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * One row in the editor's section list: reorder, duplicate, or delete a
 * section without an AI call — a structural move is not a content edit.
 * Delete gets the same one-click-arms-it, second-click-confirms pattern as
 * DeleteSiteButton, since this is the one destructive action here; move and
 * duplicate are both trivially reversible (move back, or delete the copy).
 */
export function SectionRow({
  siteId,
  pageSlug,
  section,
  isFirst,
  isLast,
}: {
  siteId: string;
  pageSlug: string;
  section: PageSection;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [upState, upAction, upPending] = useActionState(
    moveSection.bind(null, siteId, pageSlug, section.key, "up"),
    initial
  );
  const [downState, downAction, downPending] = useActionState(
    moveSection.bind(null, siteId, pageSlug, section.key, "down"),
    initial
  );
  const [dupState, dupAction, dupPending] = useActionState(
    duplicateSection.bind(null, siteId, pageSlug, section.key),
    initial
  );
  const [delState, delAction, delPending] = useActionState(
    deleteSection.bind(null, siteId, pageSlug, section.key),
    initial
  );
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const failed = [upState, downState, dupState, delState].find((s) => s.error);
    if (failed?.error) toast.error(failed.error);
  }, [upState, downState, dupState, delState]);

  const busy = upPending || downPending || dupPending || delPending;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{section.title}</p>
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{section.layout ?? "text"}</p>
      </div>
      {armed ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11px] font-semibold text-red-300">Delete?</span>
          <form action={delAction}>
            <button
              type="submit"
              disabled={busy}
              className="press rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
            >
              {delPending ? "…" : "Yes"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="press rounded-md px-2 py-1 text-[11px] text-ink-dim transition-colors hover:text-white"
          >
            Cancel
          </button>
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <form action={upAction}>
            <IconButton label="Move up" disabled={isFirst || busy} submit>
              <span aria-hidden>↑</span>
            </IconButton>
          </form>
          <form action={downAction}>
            <IconButton label="Move down" disabled={isLast || busy} submit>
              <span aria-hidden>↓</span>
            </IconButton>
          </form>
          <form action={dupAction}>
            <IconButton label="Duplicate section" disabled={busy} submit>
              <span aria-hidden>⧉</span>
            </IconButton>
          </form>
          <IconButton label="Delete section" disabled={busy} onClick={() => setArmed(true)}>
            <span aria-hidden>×</span>
          </IconButton>
        </div>
      )}
    </div>
  );
}
