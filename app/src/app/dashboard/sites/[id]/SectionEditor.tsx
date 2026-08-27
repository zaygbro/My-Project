"use client";

import { useActionState } from "react";
import { updateSiteSection, type UpdateSectionState } from "../../actions";
import type { SiteSection } from "@/lib/supabase/types";
import { GenerateWithAiButton } from "./GenerateWithAiButton";

const initialState: UpdateSectionState = { error: null };

export function SectionEditor({
  siteId,
  section,
  disabled,
  aiConfigured,
  modelLabel,
}: {
  siteId: string;
  section: SiteSection;
  disabled: boolean;
  aiConfigured: boolean;
  modelLabel: string;
}) {
  const action = updateSiteSection.bind(null, siteId, section.key);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
      <form action={formAction}>
        <label
          htmlFor={`section-${section.key}`}
          className="mb-2 block text-xs font-mono uppercase tracking-wide text-neutral-500"
        >
          {section.title}
        </label>
        <textarea
          id={`section-${section.key}`}
          name="body"
          rows={4}
          defaultValue={section.body}
          disabled={disabled}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          {state.success && !state.error && <p className="text-sm text-blue-400">Saved.</p>}
          <button
            type="submit"
            disabled={disabled || isPending}
            className="ml-auto rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {isPending ? "Rebuilding…" : "Save & rebuild section"}
          </button>
        </div>
      </form>

      {aiConfigured ? (
        <GenerateWithAiButton
          siteId={siteId}
          sectionKey={section.key}
          modelLabel={modelLabel}
          disabled={disabled}
        />
      ) : (
        <p className="mt-2 text-xs text-neutral-600">AI generation isn&rsquo;t configured yet.</p>
      )}
    </div>
  );
}
