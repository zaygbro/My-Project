"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateSitePreferredModel, type UpdateModelState } from "../../actions";
import { ModelPicker } from "../../ModelPicker";
import type { AiModelId } from "@/lib/ai/models";

const initialState: UpdateModelState = { error: null };

export function ModelSettingsForm({ siteId, current }: { siteId: string; current: AiModelId }) {
  const [selected, setSelected] = useState<AiModelId>(current);
  const action = updateSitePreferredModel.bind(null, siteId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Model updated.");
  }, [state]);

  return (
    <form action={formAction}>
      <ModelPicker name="model" value={selected} onChange={setSelected} />
      <button
        type="submit"
        disabled={selected === current || isPending}
        className="press mt-3 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-blue-500 disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-2">
          {isPending && <span className="spinner" aria-hidden />}
          {isPending ? "Updating…" : "Use this model"}
        </span>
      </button>
    </form>
  );
}
