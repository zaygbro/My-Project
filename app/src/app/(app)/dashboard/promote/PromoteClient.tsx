"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { writeAd, type WriteAdState } from "./actions";
import {
  PLATFORMS,
  PLATFORM_LIST,
  VIDEO_MODELS,
  beltCommand,
  type PlatformId,
} from "@/lib/promote/platforms";

const initialState: WriteAdState = { error: null };

interface SiteOption {
  id: string;
  name: string;
  published_at: string | null;
  subdomain: string | null;
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied (insecure origin, permissions) — say
      // so rather than showing a success state that didn't happen.
      toast.error("Couldn't copy — select the text and copy manually.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="press shrink-0 rounded-md border border-hairline bg-surface-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-dim transition-colors hover:border-ink-faint hover:text-white"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Block({
  title,
  hint,
  value,
  mono,
}: {
  title: string;
  hint?: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{title}</p>
          {hint && <p className="mt-0.5 text-[11px] text-ink-faint">{hint}</p>}
        </div>
        <CopyButton value={value} />
      </div>
      <p
        className={`whitespace-pre-wrap break-words text-sm text-ink-dim ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function PromoteClient({ sites }: { sites: SiteOption[] }) {
  const [state, formAction, isPending] = useActionState(writeAd, initialState);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [platform, setPlatform] = useState<PlatformId>("tiktok");
  const [modelId, setModelId] = useState(VIDEO_MODELS[0].id);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const spec = PLATFORMS[platform];
  const videoModel = VIDEO_MODELS.find((m) => m.id === modelId) ?? VIDEO_MODELS[0];
  const script = state.script;
  const site = sites.find((s) => s.id === siteId);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <div>
          <label htmlFor="siteId" className="mb-1 block text-xs font-mono uppercase tracking-wide text-ink-faint">
            Site to advertise
          </label>
          <select
            id="siteId"
            name="siteId"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="field-transition w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.published_at ? "" : " (not published)"}
              </option>
            ))}
          </select>
          {site && !site.published_at && (
            <p className="mt-1.5 text-[11px] text-ink-faint">
              This site isn&rsquo;t published, so the ad won&rsquo;t include a link. Publish it first if you
              want people to be able to visit.
            </p>
          )}
        </div>

        <div>
          <span className="mb-2 block text-xs font-mono uppercase tracking-wide text-ink-faint">
            Where it&rsquo;s going
          </span>
          <input type="hidden" name="platform" value={platform} />
          <div className="flex flex-wrap gap-2">
            {PLATFORM_LIST.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                aria-pressed={platform === p.id}
                className={`press rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  platform === p.id
                    ? "border-accent bg-accent-soft text-white"
                    : "border-hairline text-ink-dim hover:border-ink-faint hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-faint">
            {spec.aspect} · ~{spec.targetSeconds}s · caption up to {spec.captionLimit} chars
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="press w-full rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          <span className="inline-flex items-center justify-center gap-2">
            {isPending && <span className="spinner" aria-hidden />}
            {isPending ? "Writing your ad…" : script ? "Rewrite ad" : "Write my ad"}
          </span>
        </button>
      </form>

      {script && (
        <div className="fade-in-up space-y-4">
          <Block title="Hook — the first two seconds" value={script.hook} />

          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-ink-faint">Shot list</p>
            <ol className="space-y-3">
              {script.shots.map((shot, i) => (
                <li key={i} className="flex gap-3 border-l-2 border-hairline pl-3">
                  <span className="shrink-0 font-mono text-xs text-accent">{shot.seconds}s</span>
                  <div className="min-w-0">
                    <p className="text-sm text-ink-dim">{shot.visual}</p>
                    {shot.onScreenText && (
                      <p className="mt-1 text-xs text-ink-faint">
                        On screen: <span className="text-ink-dim">{shot.onScreenText}</span>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Render step. The prompt and command are produced here; the video
              itself is rendered by whatever tool the user runs them in. */}
          <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-accent">
              Render the video
            </p>
            <p className="mb-3 text-xs text-ink-dim">
              Paste the prompt into any text-to-video tool, or run the command below with the{" "}
              <a
                href="https://inference.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-accent-hover"
              >
                inference.sh
              </a>{" "}
              CLI (<code className="font-mono">belt</code>). Generate at {spec.aspect}.
            </p>

            <div className="mb-3">
              <label htmlFor="model" className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                Video model
              </label>
              <select
                id="model"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="field-transition w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              >
                {VIDEO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.note}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Block
            title="Video prompt"
            hint="Describes only what a camera sees — text overlays are added afterwards, since video models render written words badly."
            value={script.videoPrompt}
          />

          <Block
            title={`Command — ${videoModel.label}`}
            hint={`Runs on inference.sh. ${videoModel.audio ? "This model can generate audio." : "This model is silent — add music in your editor."}`}
            value={beltCommand(modelId, script.videoPrompt, spec.targetSeconds, videoModel.audio)}
            mono
          />

          <Block
            title={`${spec.label} caption`}
            hint={`${script.caption.length} / ${spec.captionLimit} characters`}
            value={script.caption}
          />

          {script.hashtags.length > 0 && (
            <Block title="Hashtags" value={script.hashtags.map((h) => `#${h}`).join(" ")} />
          )}

          {platform === "shorts" && <Block title="Shorts title" value={script.shortTitle} />}

          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
              Posting to {spec.label}
            </p>
            <ol className="space-y-2">
              {spec.uploadSteps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-ink-dim">
                  <span className="shrink-0 font-mono text-xs text-ink-faint">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t border-hairline-soft pt-3 text-[11px] text-ink-faint">
              Platforms change their limits — check{" "}
              <a
                href={spec.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white"
              >
                {spec.docsLabel}
              </a>{" "}
              if an upload is rejected. Max length on {spec.label} is {spec.maxSeconds}s.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
