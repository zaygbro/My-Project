"use client";

import { useActionState } from "react";
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

  return (
    <form action={formAction} className="mt-2 flex items-center gap-3">
      <button
        type="submit"
        disabled={disabled || isPending}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-blue-500 disabled:opacity-50"
      >
        {isPending ? `Generating with ${modelLabel}…` : `Generate with ${modelLabel}`}
      </button>
      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
      {state.success && !state.error && <p className="text-xs text-blue-400">Section rewritten.</p>}
    </form>
  );
}
