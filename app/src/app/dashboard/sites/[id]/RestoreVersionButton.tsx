"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { rollbackToVersion, type RollbackState } from "../../actions";

const initialState: RollbackState = { error: null };

export function RestoreVersionButton({ siteId, versionId }: { siteId: string; versionId: string }) {
  const action = rollbackToVersion.bind(null, siteId, versionId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Version restored.");
  }, [state]);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className="press rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-neutral-500 disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-2">
          {isPending && <span className="spinner" aria-hidden />}
          {isPending ? "Restoring…" : "Restore"}
        </span>
      </button>
    </form>
  );
}
