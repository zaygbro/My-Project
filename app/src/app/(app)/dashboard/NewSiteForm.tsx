"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
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

const DEFAULT_PLACEHOLDER = "Describe your site…";
const TYPE_MS = 35;
const DELETE_MS = 20;
const PAUSE_MS = 1800;

// A typewriter-style rotating placeholder — types out an example brief,
// pauses, deletes it, and moves to the next. Timer-driven, so it's a real
// side effect (belongs in an effect) rather than state derived from props.
//
// The pill is only ~200px wide on a phone (most of its width goes to the
// "+" button, model chip, and submit button), nowhere near enough to type
// a full example without it wrapping and getting clipped by the single-row
// box. Rather than guess a breakpoint, measure the field's actual rendered
// width against the widest example in its real font and skip the animation
// (falling back to a short static placeholder) when it wouldn't fit.
function useTypewriterPlaceholder(
  examples: string[],
  enabled: boolean,
  inputRef: RefObject<HTMLTextAreaElement | null>
): string {
  const [text, setText] = useState(DEFAULT_PLACEHOLDER);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = inputRef.current;
    if (!el) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const widest = Math.max(...examples.map((e) => ctx.measureText(e).width));
    if (widest > el.clientWidth) return;

    let exampleIndex = 0;
    let charIndex = 0;
    let phase: "typing" | "pausing" | "deleting" = "typing";
    let timeoutId: number;

    function tick() {
      const current = examples[exampleIndex];
      if (phase === "typing") {
        charIndex += 1;
        setText(current.slice(0, charIndex));
        if (charIndex >= current.length) {
          phase = "pausing";
          timeoutId = window.setTimeout(tick, PAUSE_MS);
        } else {
          timeoutId = window.setTimeout(tick, TYPE_MS);
        }
        return;
      }
      if (phase === "pausing") {
        // The pause already happened as the delay that led to this call —
        // move straight into deleting rather than pausing a second time.
        phase = "deleting";
        timeoutId = window.setTimeout(tick, DELETE_MS);
        return;
      }
      charIndex -= 1;
      setText(current.slice(0, charIndex));
      if (charIndex <= 0) {
        exampleIndex = (exampleIndex + 1) % examples.length;
        phase = "typing";
      }
      timeoutId = window.setTimeout(tick, DELETE_MS);
    }

    timeoutId = window.setTimeout(tick, TYPE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [examples, enabled, inputRef]);

  return text;
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
  const placeholder = useTypewriterPlaceholder(EXAMPLE_PROMPTS, !disabled, textareaRef);

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

  // Escape and click-outside dismissal — previously the only way to close
  // this panel was clicking one of the two toggle buttons again, so a
  // keyboard user tabbing away, or a mouse user clicking anywhere else on
  // the page, had no way to dismiss it.
  useEffect(() => {
    if (!modelOpen) return;
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setModelOpen(false);
    }
    function onPointerDown(e: globalThis.PointerEvent) {
      // Scoped to the whole form, not just the panel — both toggle buttons
      // live outside the panel div, so checking against the panel alone
      // would treat clicking them as "outside" and fight their own onClick.
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [modelOpen]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="space-y-3">
      <form ref={formRef} action={formAction}>
        <div className="field-transition flex items-center gap-1 rounded-full border border-hairline bg-surface py-2 pl-2 pr-2 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft">
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            aria-label="Build options"
            aria-expanded={modelOpen}
            disabled={disabled}
            className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-surface-2 hover:text-white disabled:opacity-50"
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
            placeholder={placeholder}
            className="max-h-32 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-base outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            disabled={disabled}
            className="press flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-dim transition-colors hover:bg-surface-2 hover:text-white disabled:opacity-50"
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
            className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
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
          <div className="fade-in-up mt-3 rounded-xl border border-hairline bg-surface p-3">
            <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-faint">Model</p>
            <ModelPicker
              name="model"
              value={selectedModel}
              onChange={setManualModel}
              recommendedId={recommended}
              disabled={disabled}
            />
            <p className="mt-2 text-xs text-ink-faint">
              Recommendation updates as you write the brief — longer, more detailed briefs get a more
              capable default. You can always change this later.
            </p>
          </div>
        )}
      </form>

      {disabled && (
        <p className="text-center text-xs text-ink-faint">
          You&rsquo;ve reached your plan&rsquo;s site limit — upgrade in Settings to create more.
        </p>
      )}
    </div>
  );
}
