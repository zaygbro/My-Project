"use client";

import { AI_MODELS, type AiModelId } from "@/lib/ai/models";

export function ModelPicker({
  name,
  value,
  onChange,
  recommendedId,
  disabled,
}: {
  name: string;
  value: AiModelId;
  onChange: (id: AiModelId) => void;
  recommendedId?: AiModelId;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {AI_MODELS.map((m) => (
        <label
          key={m.id}
          className={`press hover-lift cursor-pointer rounded-lg border p-3 text-sm transition-colors duration-150 ${
            value === m.id ? "border-accent bg-accent-soft" : "border-hairline bg-surface-2"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <input
            type="radio"
            name={name}
            value={m.id}
            checked={value === m.id}
            onChange={() => onChange(m.id)}
            disabled={disabled}
            className="sr-only"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{m.label}</span>
            {recommendedId === m.id && (
              <span className="badge-pop rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-dim">{m.tagline}</p>
          <p className="mt-1 font-mono text-[10px] text-ink-faint">
            ${m.inputPricePerMTok.toFixed(2)} / ${m.outputPricePerMTok.toFixed(2)} per MTok in/out
          </p>
        </label>
      ))}
    </div>
  );
}
