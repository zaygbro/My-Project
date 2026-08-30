"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { runGeneration, type RunGenerationState } from "./actions";
import { ProjectPreview } from "./ProjectPreview";
import { ModelPicker } from "../ModelPicker";
import { recommendModel, getModelInfo, type AiModelId } from "@/lib/ai/models";
import type { ChangeLogEntry } from "@/lib/generation/types";

const initialState: RunGenerationState = { error: null };

function ChangeLogRow({ entry }: { entry: ChangeLogEntry }) {
  const kindLabel: Record<ChangeLogEntry["kind"], string> = {
    generate: "Generate",
    edit: "Edit",
    fix: "Fix pass",
    validate: "Validate",
    escalate: "Escalated",
    synthesize: "Combine drafts",
  };
  const kindColor: Record<ChangeLogEntry["kind"], string> = {
    generate: "text-blue-400",
    edit: "text-blue-400",
    fix: "text-blue-400",
    validate: "text-neutral-400",
    escalate: "text-red-400",
    synthesize: "text-blue-400",
  };
  return (
    <li className="border-l-2 border-neutral-800 py-2 pl-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`font-mono text-xs font-semibold uppercase tracking-wide ${kindColor[entry.kind]}`}>
          {kindLabel[entry.kind]}
        </span>
        {entry.usage && (
          <span className="font-mono text-xs text-neutral-600">${entry.usage.costUsd.toFixed(4)}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-300">{entry.summary}</p>
      {entry.issues && entry.issues.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {entry.issues.map((issue, i) => (
            <li key={i} className="font-mono text-xs text-neutral-500">
              <span className={issue.severity === "error" ? "text-red-400" : "text-yellow-400"}>
                {issue.code}
              </span>
              : {issue.message}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function BriefIntakeForm() {
  const [state, formAction, isPending] = useActionState(runGeneration, initialState);
  const [industry, setIndustry] = useState("");
  const [tone, setTone] = useState("");
  const [pagesInput, setPagesInput] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [logoDescription, setLogoDescription] = useState("");
  const [references, setReferences] = useState("");
  const [freeformNotes, setFreeformNotes] = useState("");
  const [manualModel, setManualModel] = useState<AiModelId | null>(null);

  const recommended = useMemo(() => recommendModel(freeformNotes), [freeformNotes]);
  const selectedModel = manualModel ?? recommended;
  const parsedPages = useMemo(
    () => pagesInput.split(",").map((s) => s.trim()).filter(Boolean),
    [pagesInput]
  );

  // Every field here is controlled and deliberately never cleared on a
  // successful generation — this is a "tweak the brief and regenerate"
  // tool, not a one-shot form, so the brief should persist across runs.
  //
  // liveResult is the single source of truth once a project exists —
  // ProjectPreview is a controlled component that reports edits back into
  // it, so the change-log panel below always reflects edits too, not just
  // the original generation. It resets to the fresh result whenever a new
  // generation actually completes (state.result changes identity).
  const [prevState, setPrevState] = useState(state);
  const [liveResult, setLiveResult] = useState(state.result);
  if (state !== prevState) {
    setPrevState(state);
    if (state.error) toast.error(state.error);
    if (state.result) setLiveResult(state.result);
  }

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="industry" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
              Industry
            </label>
            <input
              id="industry"
              name="industry"
              required
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Architecture studio"
              className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label htmlFor="tone" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
              Tone
            </label>
            <input
              id="tone"
              name="tone"
              required
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Minimalist, editorial"
              className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        <div>
          <label htmlFor="mustHavePages" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
            Must-have pages <span className="normal-case text-neutral-600">(comma-separated)</span>
          </label>
          <input
            id="mustHavePages"
            name="mustHavePages"
            required
            value={pagesInput}
            onChange={(e) => setPagesInput(e.target.value)}
            placeholder="Home, Projects, Contact"
            className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
          {parsedPages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parsedPages.map((page) => (
                <span
                  key={page}
                  className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-xs text-neutral-400"
                >
                  {page}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="primaryColor" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
              Brand color <span className="normal-case text-neutral-600">(optional)</span>
            </label>
            <input
              id="primaryColor"
              name="primaryColor"
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#1a1a1a"
              className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label htmlFor="logoDescription" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
              Logo/brand notes <span className="normal-case text-neutral-600">(optional)</span>
            </label>
            <input
              id="logoDescription"
              name="logoDescription"
              value={logoDescription}
              onChange={(e) => setLogoDescription(e.target.value)}
              placeholder="A simple geometric mark, no gradients"
              className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        <div>
          <label htmlFor="references" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
            References <span className="normal-case text-neutral-600">(optional, one per line)</span>
          </label>
          <textarea
            id="references"
            name="references"
            rows={2}
            value={references}
            onChange={(e) => setReferences(e.target.value)}
            placeholder="Kinfolk magazine aesthetic"
            className="field-transition w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        <div>
          <label htmlFor="freeformNotes" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
            Additional notes <span className="normal-case text-neutral-600">(optional)</span>
          </label>
          <textarea
            id="freeformNotes"
            name="freeformNotes"
            rows={2}
            value={freeformNotes}
            onChange={(e) => setFreeformNotes(e.target.value)}
            placeholder="Anything else the council should know about this client."
            className="field-transition w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-mono uppercase tracking-wide text-neutral-500">Model</label>
          <ModelPicker name="model" value={selectedModel} onChange={setManualModel} recommendedId={recommended} />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="press w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50"
        >
          <span className="inline-flex items-center justify-center gap-2">
            {isPending && <span className="spinner" aria-hidden />}
            {isPending ? `Running the council on ${getModelInfo(selectedModel).label}…` : "Generate project"}
          </span>
        </button>
      </form>

      {liveResult && (
        <div className="fade-in-up space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wide text-neutral-500">Generation state</h2>
            <span
              className={`rounded-full px-3 py-1 font-mono text-xs font-bold uppercase ${
                liveResult.status === "validated" ? "bg-blue-950/40 text-blue-400" : "bg-red-950/40 text-red-400"
              }`}
            >
              {liveResult.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
            <span>
              Pages: <span className="text-white">{liveResult.pages.map((p) => p.slug).join(", ") || "none"}</span>
            </span>
            <span>
              Cost so far: <span className="font-mono text-white">${liveResult.totalCostUsd.toFixed(4)}</span>
            </span>
          </div>

          {liveResult.status === "validated" ? (
            <ProjectPreview
              key={liveResult.changeLog[0]?.timestamp ?? "none"}
              state={liveResult}
              onChange={setLiveResult}
            />
          ) : (
            <p className="rounded-lg border border-red-900 bg-red-950/20 px-3 py-2 text-sm text-red-300">
              This generation failed validation twice in a row and stopped rather than retrying silently — there
              is nothing safe to preview yet. See the log below for exactly what&rsquo;s wrong, then try again.
            </p>
          )}

          <div>
            <h3 className="mb-2 text-xs font-mono uppercase tracking-wide text-neutral-600">Change log</h3>
            <ul>
              {liveResult.changeLog.map((entry, i) => (
                <ChangeLogRow key={i} entry={entry} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
