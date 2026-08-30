"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChangeLogEntry, DesignTokens, GeneratedPage } from "@/lib/generation/types";
import type { GenerationStatus } from "@/lib/supabase/types";
import { getGenerationStatus, retryGeneration, startGeneration, type GenerationSnapshot } from "./generation-actions";
import { LivePreview } from "./LivePreview";

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
  initialPages,
  initialTokens,
}: {
  siteId: string;
  initialStatus: GenerationStatus;
  initialChangeLog: ChangeLogEntry[];
  initialError: string | null;
  initialPages: GeneratedPage[];
  initialTokens: DesignTokens | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<GenerationStatus>(initialStatus);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>(initialChangeLog);
  const [error, setError] = useState<string | null>(initialError);
  const [pages, setPages] = useState<GeneratedPage[]>(initialPages);
  const [tokens, setTokens] = useState<DesignTokens | null>(initialTokens);
  const [isRetrying, startRetry] = useTransition();
  const [stalled, setStalled] = useState(false);

  function applySnapshot(snapshot: GenerationSnapshot) {
    setStatus(snapshot.status);
    setChangeLog(snapshot.changeLog);
    setError(snapshot.error);
    setPages(snapshot.pages);
    setTokens(snapshot.tokens);
  }

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
      applySnapshot(snapshot);
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
      applySnapshot(snapshot);
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [siteId, status]);

  // Once the site really exists, re-render the server component tree so the
  // finished pages replace this screen.
  //
  // router.refresh() alone is not enough to rely on here. If the refreshed
  // payload is served from the router cache, or the refresh lands before the
  // action's revalidatePath has propagated, the server still reports the old
  // status and this component stays mounted — leaving the build screen stuck
  // on "Loading your site…" forever with no way out.
  //
  // Still being mounted a moment after the refresh is itself the signal that
  // it didn't take (a successful one unmounts this component), so that's the
  // cue to fall back to a hard reload, which cannot be served from that cache.
  useEffect(() => {
    if (status !== "validated") return;
    router.refresh();
    const timer = setTimeout(() => window.location.reload(), 2500);
    return () => clearTimeout(timer);
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

  // Anything that isn't one of the four known states means this screen has
  // nothing to do and nothing to wait for — it won't start, poll, or reload.
  // Previously that rendered as a permanent "Done / Loading your site…", so
  // treat it as an error with a way out rather than a dead end.
  const unknownState = !running && status !== "validated" && status !== "failed";

  return (
    <div className="fade-in-up grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="flex items-center gap-3">
        {running && <span className="spinner" aria-hidden />}
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            {running
              ? "Building your site…"
              : status === "failed"
                ? "Generation stopped"
                : unknownState
                  ? "This build is in an unknown state"
                  : "Done"}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {running
              ? "Four engines run over your brief, then everything is validated before it reaches you."
              : status === "failed"
                ? "Nothing half-built was saved — here's exactly what went wrong."
                : unknownState
                  ? "The server didn't report a build status for this site, so there's nothing to wait for. This usually means the database is missing the generation columns."
                  : "Loading your site…"}
          </p>
        </div>
      </div>

      {/* Once the run is done the stage list has nothing left to say, and
          rendering it from an empty change log would show every stage as
          un-started next to a "Done" heading — which reads as broken. */}
      <ol
        className="mt-6 space-y-3"
        aria-live="polite"
        hidden={unknownState || (status === "validated" && changeLog.length === 0)}
      >
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

      {(status === "failed" || stalled || unknownState) && (
        <div
          className={`mt-6 rounded-lg border p-4 ${
            status === "failed" ? "border-red-900 bg-red-950/20" : "border-neutral-800 bg-neutral-900/40"
          }`}
        >
          <p className={`text-sm ${status === "failed" ? "text-red-300" : "text-neutral-400"}`}>
            {status === "failed"
              ? (error ?? "Generation failed.")
              : unknownState
                ? "Try starting the build again. If it lands back here, the newer migrations (0006, 0007) probably haven't been applied to the database yet."
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
                setPages([]);
                setTokens(null);
                const snapshot = await retryGeneration(siteId);
                applySnapshot(snapshot);
              })
            }
            className="press mt-3 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {isRetrying ? "Retrying…" : status === "failed" ? "Try again" : unknownState ? "Start build" : "Start over"}
          </button>
        </div>
      )}
      </div>

      {/* Right pane: the actual site, rendered live as the pipeline produces
          it — real pages and copy the moment a model call returns them, not
          a mockup that appears only once everything is done. */}
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-neutral-500">Live preview</p>
        <LivePreview pages={pages} tokens={tokens} />
      </div>
    </div>
  );
}
