"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { generateSectionWithAI, type GenerateSectionState } from "../../actions";

const initialState: GenerateSectionState = { error: null };

export function GenerateWithAiButton({
  siteId,
  sectionKey,
  modelLabel,
  disabled,
}: {
  siteId: string;
  sectionKey: string;
  modelLabel: string;
  disabled: boolean;
}) {
  const action = generateSectionWithAI.bind(null, siteId, sectionKey);
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Section rewritten.");
  }, [state]);

  return (
    <form action={formAction} className="mt-2">
      <button
        type="submit"
        disabled={disabled || isPending}
        className="press rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-blue-500 disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-2">
          {isPending && <span className="spinner" aria-hidden />}
          {isPending ? `Generating with ${modelLabel}…` : `Generate with ${modelLabel}`}
        </span>
      </button>
    </form>
  );
}
