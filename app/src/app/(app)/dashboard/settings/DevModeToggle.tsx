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
      className="press rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-300 transition-colors hover:border-blue-600 disabled:opacity-60"
    >
      {viewingAsRegular ? "Switch back to dev account" : "View as a regular user"}
    </button>
  );
}
