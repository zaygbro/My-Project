"use client";

import { useState } from "react";

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICES: { mode: DeviceMode; label: string; width: string }[] = [
  { mode: "desktop", label: "Desktop", width: "100%" },
  { mode: "tablet", label: "Tablet", width: "768px" },
  { mode: "mobile", label: "Mobile", width: "390px" },
];

/**
 * The real /preview/[id] renderer inside a resizable frame — never a
 * separate editor-only mock. Switching device mode changes the iframe's
 * actual width (so the page's own responsive CSS kicks in), not a CSS
 * transform scaling a fixed-size desktop render down.
 */
export function EditorPreview({
  siteId,
  siteName,
  previewKey,
}: {
  siteId: string;
  siteName: string;
  previewKey: number;
}) {
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const active = DEVICES.find((d) => d.mode === device)!;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        role="group"
        aria-label="Preview device size"
        className="flex shrink-0 items-center gap-1 self-center rounded-full border border-hairline bg-surface-2 p-1"
      >
        {DEVICES.map((d) => (
          <button
            key={d.mode}
            type="button"
            onClick={() => setDevice(d.mode)}
            aria-pressed={device === d.mode}
            className={`press rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              device === d.mode ? "bg-accent text-white" : "text-ink-faint hover:text-white"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded-2xl border border-hairline bg-surface-2/30 p-3">
        <div
          className="field-transition h-full min-h-0 overflow-hidden rounded-xl border border-hairline bg-background shadow-xl"
          style={{ width: active.width, maxWidth: "100%" }}
        >
          <iframe
            key={previewKey}
            src={`/preview/${siteId}`}
            title={`${siteName} — live preview`}
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}
