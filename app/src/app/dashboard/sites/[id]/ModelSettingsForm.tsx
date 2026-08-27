"use client";

import { useState } from "react";
import { updateSitePreferredModel } from "../../actions";
import { ModelPicker } from "../../ModelPicker";
import type { AiModelId } from "@/lib/ai/models";

export function ModelSettingsForm({ siteId, current }: { siteId: string; current: AiModelId }) {
  const [selected, setSelected] = useState<AiModelId>(current);
  const action = updateSitePreferredModel.bind(null, siteId);

  return (
    <form action={action}>
      <ModelPicker name="model" value={selected} onChange={setSelected} />
      <button
        type="submit"
        disabled={selected === current}
        className="mt-3 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:border-blue-500 disabled:opacity-50"
      >
        Use this model
      </button>
    </form>
  );
}
