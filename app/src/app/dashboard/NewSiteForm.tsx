"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { createSite, type CreateSiteState } from "./actions";
import { ModelPicker } from "./ModelPicker";
import { recommendModel, getModelInfo, type AiModelId } from "@/lib/ai/models";

const initialState: CreateSiteState = { error: null };

const EXAMPLE_PROMPTS = [
  "A modern landing page for a minimalist coffee roastery in Kyoto",
  "A portfolio site for a wedding photographer with a romantic, elegant feel",
  "A booking page for a boutique fitness studio with class schedules",
  "A menu and location page for a dog-friendly neighborhood cafe",
  "A pricing and features page for a SaaS analytics dashboard",
  "A storefront for an independent record label",
  "A services page for a pediatric dental practice",
  "A one-page site for a corporate law firm's practice areas",
];

// Rotates daily rather than per-render — picking with Math.random() on
// every render would pick different examples during the server render vs.
// the client hydration pass and throw a hydration mismatch.
function todaysExamples(count: number): string[] {
  const start = new Date().getDate() % EXAMPLE_PROMPTS.length;
  return Array.from({ length: count }, (_, i) => EXAMPLE_PROMPTS[(start + i) % EXAMPLE_PROMPTS.length]);
}

export function NewSiteForm({ disabled }: { disabled: boolean }) {
  const [state, formAction, isPending] = useActionState(createSite, initialState);
  const [brief, setBrief] = useState("");
  const [manualModel, setManualModel] = useState<AiModelId | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const recommended = useMemo(() => recommendModel(brief), [brief]);
  const selectedModel = manualModel ?? recommended;
  const examples = useMemo(() => todaysExamples(3), []);

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

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function fillExample(example: string) {
    setBrief(example);
    textareaRef.current?.focus();
  }

  return (
    <div className="space-y-3">
      <form ref={formRef} action={formAction}>
        <div className="field-transition flex items-center gap-1 rounded-full border border-blue-900/50 bg-neutral-950 py-2 pl-2 pr-2 shadow-2xl shadow-blue-500/10 focus-within:border-blue-500">
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            aria-label="Build options"
            aria-expanded={modelOpen}
            disabled={disabled}
            className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-white disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            id="brief"
            name="brief"
            required
            disabled={disabled}
            aria-label="Describe the site you want"
            rows={1}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the site you want to build…"
            className="max-h-32 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-base outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            disabled={disabled}
            className="press flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white disabled:opacity-50"
          >
            <span className="hidden sm:inline">{getModelInfo(selectedModel).label}</span>
            <span aria-hidden className={`transition-transform ${modelOpen ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>
          <button
            type="submit"
            disabled={disabled || isPending || !brief.trim()}
            aria-label="Build"
            className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:opacity-40"
          >
            {isPending ? (
              <span className="spinner" aria-hidden />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        {modelOpen && (
          <div className="fade-in-up mt-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <p className="mb-2 font-mono text-xs uppercase tracking-wide text-neutral-500">Model</p>
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
        )}
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => fillExample(example)}
            disabled={disabled}
            className="press rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-blue-800 hover:text-white disabled:opacity-50"
          >
            {example.length > 44 ? `${example.slice(0, 41)}…` : example}
          </button>
        ))}
      </div>

      {disabled && (
        <p className="text-center text-xs text-neutral-500">
          You&rsquo;ve reached your plan&rsquo;s site limit — upgrade in Settings to create more.
        </p>
      )}
    </div>
  );
}
