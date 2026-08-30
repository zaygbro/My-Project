"use client";

import { useState } from "react";

/**
 * A destructive action needs to require a second, deliberate action before
 * anything happens — but this app never uses window.confirm() anywhere
 * else, so the confirmation is an inline UI state instead: one click arms
 * it, revealing a real Yes/No choice in place of the trash icon (using
 * .badge-pop, the same mount-pop already used for state-indicating badges
 * elsewhere), and a second click actually calls onConfirm. Clicking
 * anywhere else doesn't count as either — dismissal is explicit.
 */
export function DeleteSiteButton({
  onConfirm,
  disabled,
  variant = "icon",
}: {
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "icon" | "full";
}) {
  const [armed, setArmed] = useState(false);

  // Both button clicks stop propagation — this renders inside a card that's
  // itself a <Link> in the icon variant, and neither confirming nor
  // cancelling a delete should navigate.
  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (armed) {
    return (
      <span
        role="group"
        aria-label="Confirm delete"
        onClick={stop}
        className={`badge-pop inline-flex items-center gap-1 rounded-full border border-red-800 bg-red-950/80 p-1 pl-2.5 backdrop-blur-sm ${variant === "full" ? "" : "shadow-lg"}`}
      >
        <span className="text-[11px] font-semibold whitespace-nowrap text-red-200">
          {variant === "full" ? "Delete this site?" : "Delete?"}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            stop(e);
            onConfirm();
          }}
          className="press rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
        >
          {disabled ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            stop(e);
            setArmed(false);
          }}
          className="press rounded-full px-2 py-1 text-[11px] text-ink-dim transition-colors hover:text-white disabled:opacity-60"
        >
          Cancel
        </button>
      </span>
    );
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setArmed(true);
        }}
        className="delete-trash-button press inline-flex items-center gap-2 rounded-lg border border-red-900/60 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30 hover:text-red-300"
      >
        <TrashIcon />
        Delete site
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Delete site"
      onClick={(e) => {
        stop(e);
        setArmed(true);
      }}
      className="delete-trash-button press flex h-8 w-8 items-center justify-center rounded-full border border-red-900/50 bg-black/50 text-red-500 backdrop-blur-sm transition-colors hover:border-red-600 hover:bg-red-950/70 hover:text-red-400"
    >
      <TrashIcon />
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className="delete-trash-icon"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}
