"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateDesignTokens, type UpdateTokensState } from "./design-actions";
import type { DesignTokens } from "@/lib/generation/types";

const initial: UpdateTokensState = { error: null };

const RADIUS_PRESETS = [
  { label: "Sharp", value: "0px" },
  { label: "Subtle", value: "4px" },
  { label: "Rounded", value: "8px" },
  { label: "Soft", value: "16px" },
  { label: "Pill-like", value: "24px" },
];

function ColorField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-dim">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-hairline bg-transparent p-0"
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="field-transition w-24 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 font-mono text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </span>
    </label>
  );
}

/**
 * Direct token editing without going through the AI — colors, the two
 * fonts, and border radius, the complete set our schema actually has (see
 * DesignTokens). No "layout density" control: nothing in the render
 * pipeline currently reads a spacing-scale token, so a control for one
 * would change nothing — see design-actions.ts for the validation this
 * writes through (sanitized the same way generation output is, and
 * rejected outright on a contrast failure rather than saved unreadable).
 */
export function DesignPanel({ siteId, tokens }: { siteId: string; tokens: DesignTokens }) {
  const [draft, setDraft] = useState(tokens);
  const action = updateDesignTokens.bind(null, siteId);
  const [state, formAction, isPending] = useActionState(action, initial);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Design updated.");
  }, [state]);

  function setColor(key: keyof DesignTokens["colors"], value: string) {
    setDraft((d) => ({ ...d, colors: { ...d.colors, [key]: value } }));
  }

  return (
    <form action={formAction} className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-hairline bg-background p-4">
      <div>
        <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-faint">Colors</h2>
        <div className="space-y-2">
          <ColorField label="Background" name="background" value={draft.colors.background} onChange={(v) => setColor("background", v)} />
          <ColorField label="Surface" name="surface" value={draft.colors.surface} onChange={(v) => setColor("surface", v)} />
          <ColorField label="Text" name="text" value={draft.colors.text} onChange={(v) => setColor("text", v)} />
          <ColorField label="Muted text" name="textMuted" value={draft.colors.textMuted} onChange={(v) => setColor("textMuted", v)} />
          <ColorField label="Accent" name="accent" value={draft.colors.accent} onChange={(v) => setColor("accent", v)} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-faint">Typography</h2>
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-dim">Heading font</span>
            <input
              type="text"
              name="display"
              value={draft.fonts.display}
              onChange={(e) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, display: e.target.value } }))}
              placeholder="A Google Font name"
              className="field-transition w-40 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-dim">Body font</span>
            <input
              type="text"
              name="body"
              value={draft.fonts.body}
              onChange={(e) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, body: e.target.value } }))}
              placeholder="A Google Font name"
              className="field-transition w-40 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-faint">Shape</h2>
        <div className="flex flex-wrap gap-1.5">
          {RADIUS_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, radius: preset.value }))}
              className={`press rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                draft.radius === preset.value
                  ? "border-accent bg-accent-soft text-white"
                  : "border-hairline text-ink-dim hover:text-white"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="radius" value={draft.radius} />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="press mt-auto shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save design"}
      </button>
    </form>
  );
}
