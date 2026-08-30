"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChangeLogEntry } from "@/lib/generation/types";
import type { GenerationStatus } from "@/lib/supabase/types";
import { getGenerationStatus, retryGeneration, startGeneration } from "./generation-actions";

const POLL_MS = 2000;
// A generation run lives inside a server action, so a closed tab or a killed
// invocation can leave a site "generating" with nothing left to finish it.
// After this long with no new build-log entry, offer a way out instead of
// spinning forever.
const STALL_MS = 120_000;

// The four things the pipeline actually does, in order. Each lights up when a
// matching change-log entry lands, so this reflects real backend stages
// rather than a timer pretending to be progress.
const STAGES: { kind: ChangeLogEntry["kind"]; label: string; detail: string }[] = [
  { kind: "generate", label: "Structure & copy", detail: "Drafting pages and section copy from your brief" },
  { kind: "validate", label: "Assurance", detail: "Checking contrast, links, and real copy" },
  { kind: "fix", label: "Reconciliation", detail: "Correcting anything assurance flagged" },
];

function stageState(
  log: ChangeLogEntry[],
  kind: ChangeLogEntry["kind"],
  status: GenerationStatus
): "done" | "active" | "pending" | "skipped" {
  const seen = log.some((e) => e.kind === kind);
  if (seen) {
    // A stage is still active if it's the most recent thing that happened
    // and the run hasn't finished.
    const isLast = log[log.length - 1]?.kind === kind;
    return isLast && (status === "generating" || status === "pending") ? "active" : "done";
  }
  if (status === "generating" || status === "pending") return "pending";
  // The run is over and this never happened — for the fix pass that's the
  // good outcome (nothing needed correcting), not a failure.
  return kind === "fix" ? "skipped" : "pending";
}

export function BuildProgress({
  siteId,
  initialStatus,
  initialChangeLog,
  initialError,
}: {
  siteId: string;
  initialStatus: GenerationStatus;
  initialChangeLog: ChangeLogEntry[];
  initialError: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<GenerationStatus>(initialStatus);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>(initialChangeLog);
  const [error, setError] = useState<string | null>(initialError);
  const [isRetrying, startRetry] = useTransition();
  const [stalled, setStalled] = useState(false);

  // Kick the run off exactly once per mount. startGeneration itself is the
  // real guard against double-charging (its claim is a conditional update);
  // this ref just avoids firing a redundant request under Strict Mode.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    if (initialStatus !== "pending") return;
    startedRef.current = true;
    let cancelled = false;
    startGeneration(siteId).then((snapshot) => {
      if (cancelled) return;
      setStatus(snapshot.status);
      setChangeLog(snapshot.changeLog);
      setError(snapshot.error);
    });
    return () => {
      cancelled = true;
    };
  }, [siteId, initialStatus]);

  // Poll while a run is in flight — including a run started by a different
  // tab, or one already underway when this page loaded.
  useEffect(() => {
    if (status !== "generating" && status !== "pending") return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const snapshot = await getGenerationStatus(siteId);
      if (cancelled) return;
      setStatus(snapshot.status);
      setChangeLog(snapshot.changeLog);
      setError(snapshot.error);
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [siteId, status]);

  // Once the site really exists, re-render the server component tree so the
  // finished pages replace this screen.
  useEffect(() => {
    if (status === "validated") router.refresh();
  }, [status, router]);

  // Watch for a run that has stopped making progress. Any new stage resets
  // the clock, so a slow-but-alive run is never flagged — only a genuinely
  // stalled one. Clearing the flag happens during render (not in the effect
  // below) per the project's set-state-in-effect convention.
  const stallKey = `${status}:${changeLog.length}`;
  const [prevStallKey, setPrevStallKey] = useState(stallKey);
  if (stallKey !== prevStallKey) {
    setPrevStallKey(stallKey);
    if (stalled) setStalled(false);
  }

  useEffect(() => {
    if (status !== "generating" && status !== "pending") return;
    const timer = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(timer);
  }, [status, changeLog.length]);

  const running = status === "pending" || status === "generating";
  const spent = changeLog.reduce((sum, e) => sum + (e.usage?.costUsd ?? 0), 0);

  return (
    <div className="fade-in-up rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="flex items-center gap-3">
        {running && <span className="spinner" aria-hidden />}
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            {running ? "Building your site…" : status === "failed" ? "Generation stopped" : "Done"}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {running
              ? "Four engines run over your brief, then everything is validated before it reaches you."
              : status === "failed"
                ? "Nothing half-built was saved — here's exactly what went wrong."
                : "Loading your site…"}
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-3" aria-live="polite">
        {STAGES.map((stage) => {
          const state = stageState(changeLog, stage.kind, status);
          return (
            <li key={stage.kind} className="flex items-start gap-3">
              <span
                aria-hidden
                className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${
                  state === "done"
                    ? "border-blue-500 bg-blue-500 text-white"
                    : state === "active"
                      ? "border-blue-500 text-blue-400"
                      : "border-neutral-700 text-neutral-700"
                }`}
              >
                {state === "done" ? "✓" : state === "skipped" ? "–" : ""}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    state === "pending" ? "text-neutral-600" : "text-neutral-200"
                  }`}
                >
                  {stage.label}
                  {state === "skipped" && (
                    <span className="ml-2 font-normal text-neutral-600">not needed</span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">{stage.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {changeLog.length > 0 && (
        <div className="mt-6 border-t border-neutral-900 pt-4">
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-neutral-600">Build log</p>
          <ul className="space-y-1.5">
            {changeLog.map((entry, i) => (
              <li key={i} className="fade-in-up text-xs">
                <span
                  className={`font-mono uppercase ${
                    entry.kind === "escalate" ? "text-red-400" : "text-blue-400"
                  }`}
                >
                  {entry.kind}
                </span>
                <span className="ml-2 text-neutral-400">{entry.summary}</span>
                {entry.issues?.map((issue, j) => (
                  <span key={j} className="mt-0.5 block pl-4 font-mono text-[11px] text-neutral-600">
                    {issue.code}: {issue.message}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          {spent > 0 && (
            <p className="mt-3 font-mono text-xs text-neutral-600">Spent so far: ${spent.toFixed(4)}</p>
          )}
        </div>
      )}

      {(status === "failed" || stalled) && (
        <div
          className={`mt-6 rounded-lg border p-4 ${
            status === "failed" ? "border-red-900 bg-red-950/20" : "border-neutral-800 bg-neutral-900/40"
          }`}
        >
          <p className={`text-sm ${status === "failed" ? "text-red-300" : "text-neutral-400"}`}>
            {status === "failed"
              ? (error ?? "Generation failed.")
              : "This build has gone quiet — it may have been interrupted. You can start it over."}
          </p>
          <button
            type="button"
            disabled={isRetrying}
            onClick={() =>
              startRetry(async () => {
                setStalled(false);
                setStatus("generating");
                setChangeLog([]);
                setError(null);
                const snapshot = await retryGeneration(siteId);
                setStatus(snapshot.status);
                setChangeLog(snapshot.changeLog);
                setError(snapshot.error);
              })
            }
            className="press mt-3 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {isRetrying ? "Retrying…" : status === "failed" ? "Try again" : "Start over"}
          </button>
        </div>
      )}
    </div>
  );
}
