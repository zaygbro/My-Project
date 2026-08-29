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
      className="space-y-3 rounded-2xl border border-blue-900/50 bg-neutral-950 p-4 shadow-2xl shadow-blue-500/10"
    >
      <input
        id="name"
        name="name"
        required
        disabled={disabled}
        aria-label="Site name"
        placeholder="Site name — Kyoto Coffee Roastery"
        className="field-transition w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-neutral-600 focus:border-neutral-800 disabled:opacity-50"
      />
      <textarea
        id="brief"
        name="brief"
        disabled={disabled}
        aria-label="Site brief"
        rows={3}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder="Describe the site you want — a modern landing page for a minimalist coffee roastery in Kyoto…"
        className="field-transition w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-3">
        <details className="group min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-900">
          <summary className="press flex cursor-pointer items-center justify-between px-3 py-2 text-sm marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <span className="hidden font-mono text-xs uppercase tracking-wide text-neutral-500 sm:inline">
                Model
              </span>
              <span className="truncate font-semibold">{getModelInfo(selectedModel).label}</span>
              {selectedModel === recommended && (
                <span className="badge-pop shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  Recommended
                </span>
              )}
            </span>
            <span aria-hidden className="shrink-0 text-neutral-500 transition-transform group-open:rotate-180">
              ▾
            </span>
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
          className="press shrink-0 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            {isPending && <span className="spinner" aria-hidden />}
            {isPending ? "Creating…" : "Build"}
          </span>
        </button>
      </div>
      {disabled && (
        <p className="text-xs text-neutral-500">
          You&rsquo;ve reached your plan&rsquo;s site limit — upgrade in Settings to create more.
        </p>
      )}
    </form>
  );
}
