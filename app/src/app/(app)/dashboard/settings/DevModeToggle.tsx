"use client";

import { useTransition } from "react";
import { setDevViewMode } from "./actions";

export function DevModeToggle({ viewingAsRegular }: { viewingAsRegular: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => setDevViewMode(!viewingAsRegular))}
      className="press rounded-full border border-accent/50 bg-accent-soft px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-accent disabled:opacity-60"
    >
      {viewingAsRegular ? "Switch back to dev account" : "View as a regular user"}
    </button>
  );
}
