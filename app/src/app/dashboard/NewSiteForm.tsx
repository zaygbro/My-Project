"use client";

import { useActionState, useMemo, useState } from "react";
import { createSite, type CreateSiteState } from "./actions";
import { ModelPicker } from "./ModelPicker";
import { recommendModel, type AiModelId } from "@/lib/ai/models";

const initialState: CreateSiteState = { error: null };

export function NewSiteForm({ disabled }: { disabled: boolean }) {
  const [state, formAction, isPending] = useActionState(createSite, initialState);
  const [brief, setBrief] = useState("");
  const [manualModel, setManualModel] = useState<AiModelId | null>(null);

  const recommended = useMemo(() => recommendModel(brief), [brief]);
  const selectedModel = manualModel ?? recommended;

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
      <div>
        <label htmlFor="name" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
          Site name
        </label>
        <input
          id="name"
          name="name"
          required
          disabled={disabled}
          placeholder="Kyoto Coffee Roastery"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>
      <div>
        <label htmlFor="brief" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
          Brief (optional)
        </label>
        <textarea
          id="brief"
          name="brief"
          disabled={disabled}
          rows={2}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="A modern landing page for a minimalist coffee roastery in Kyoto…"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-mono uppercase tracking-wide text-neutral-500">
          AI model for section drafts
        </label>
        <ModelPicker
          name="model"
          value={selectedModel}
          onChange={setManualModel}
          recommendedId={recommended}
          disabled={disabled}
        />
        <p className="mt-2 text-xs text-neutral-600">
          Recommendation updates as you write the brief — longer, more detailed briefs get a more capable
          default. You can always change this later.
        </p>
      </div>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={disabled || isPending}
        className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create site"}
      </button>
      {disabled && (
        <p className="text-xs text-neutral-500">
          You&rsquo;ve reached your plan&rsquo;s site limit — upgrade above to create more.
        </p>
      )}
    </form>
  );
}
