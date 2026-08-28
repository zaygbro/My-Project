"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createSite, type CreateSiteState } from "./actions";
import { ModelPicker } from "./ModelPicker";
import { recommendModel, getModelInfo, type AiModelId } from "@/lib/ai/models";

const initialState: CreateSiteState = { error: null };

export function NewSiteForm({ disabled }: { disabled: boolean }) {
  const [state, formAction, isPending] = useActionState(createSite, initialState);
  const [brief, setBrief] = useState("");
  const [manualModel, setManualModel] = useState<AiModelId | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const recommended = useMemo(() => recommendModel(brief), [brief]);
  const selectedModel = manualModel ?? recommended;

  // Reset the locally-tracked fields when a new action result arrives —
  // done during render (not an effect) per React's "adjust state when a
  // prop changes" pattern, since `state` is a fresh object each time the
  // action completes.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) {
      setBrief("");
      setManualModel(null);
    }
  }

  // The toast and native form reset are real side effects (an external
  // library, the DOM) — those belong in an effect.
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) {
      toast.success("Site created.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950 p-5"
    >
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
          className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
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
          className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        />
      </div>
      <details className="group rounded-lg border border-neutral-800 bg-neutral-900">
        <summary className="press flex cursor-pointer items-center justify-between px-3 py-2 text-sm marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wide text-neutral-500">Model</span>
            <span className="font-semibold">{getModelInfo(selectedModel).label}</span>
            {selectedModel === recommended && (
              <span className="badge-pop rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                Recommended
              </span>
            )}
          </span>
          <span aria-hidden className="text-neutral-500 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-neutral-800 p-3">
          <ModelPicker
            name="model"
            value={selectedModel}
            onChange={setManualModel}
            recommendedId={recommended}
            disabled={disabled}
          />
          <p className="mt-2 text-xs text-neutral-600">
            Recommendation updates as you write the brief — longer, more detailed briefs get a more
            capable default. You can always change this later.
          </p>
        </div>
      </details>
      <button
        type="submit"
        disabled={disabled || isPending}
        className="press rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-2">
          {isPending && <span className="spinner" aria-hidden />}
          {isPending ? "Creating…" : "Create site"}
        </span>
      </button>
      {disabled && (
        <p className="text-xs text-neutral-500">
          You&rsquo;ve reached your plan&rsquo;s site limit — upgrade above to create more.
        </p>
      )}
    </form>
  );
}
