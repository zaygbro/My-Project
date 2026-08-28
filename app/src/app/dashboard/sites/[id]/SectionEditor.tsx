"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
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

  // Controlled, synced from the prop: keeps the field live after an
  // external change (AI generation, a rollback) without remounting this
  // component and losing the useActionState result the toast effect
  // below depends on. Synced during render (React's "adjust state when a
  // prop changes" pattern), not in an effect — an effect here would
  // commit the stale value for one paint before correcting it.
  const [body, setBody] = useState(section.body);
  const [prevPropBody, setPrevPropBody] = useState(section.body);
  if (section.body !== prevPropBody) {
    setPrevPropBody(section.body);
    setBody(section.body);
  }

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Section saved.");
  }, [state]);

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
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={disabled}
          className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        />
        <div className="mt-3 flex items-center justify-end">
          <button
            type="submit"
            disabled={disabled || isPending}
            className="press rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {isPending && <span className="spinner" aria-hidden />}
              {isPending ? "Rebuilding…" : "Save & rebuild section"}
            </span>
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
