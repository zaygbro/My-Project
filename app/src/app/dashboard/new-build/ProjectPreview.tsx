"use client";

import { useMemo, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { toast } from "sonner";
import { editSectionAction } from "./actions";
import type { GeneratedPage, ProjectState } from "@/lib/generation/types";

const MARKDOWN_LINK = /\[([^\]]+)\]\((\/[a-z0-9-]*)\)/gi;

/** Renders body text, turning validated internal links into real page-tab
 * navigation instead of dead anchors — the validator already guarantees
 * every link here points at a page that actually exists. Uses matchAll
 * (a fresh iterator per call) rather than exec()+lastIndex, since mutating
 * a module-level regex's lastIndex during render isn't safe under the
 * React Compiler. */
function BodyWithLinks({ body, onNavigate }: { body: string; onNavigate: (slug: string) => void }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of body.matchAll(MARKDOWN_LINK)) {
    if (match.index > lastIndex) parts.push(body.slice(lastIndex, match.index));
    const slug = match[2].replace(/^\//, "") || "index";
    parts.push(
      <button
        key={key++}
        type="button"
        onClick={() => onNavigate(slug)}
        className="preview-accent underline underline-offset-2"
      >
        {match[1]}
      </button>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return <>{parts}</>;
}

function EditableSection({
  page,
  sectionKey,
  title,
  body,
  onSubmitEdit,
  onNavigate,
  disabled,
}: {
  page: string;
  sectionKey: string;
  title: string;
  body: string;
  onSubmitEdit: (page: string, sectionKey: string, instruction: string) => void;
  onNavigate: (slug: string) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!instruction.trim()) return;
    onSubmitEdit(page, sectionKey, instruction.trim());
    setInstruction("");
    setEditing(false);
  }

  return (
    <div className="group preview-surface relative p-5">
      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={disabled}
          className="press absolute top-3 right-3 rounded-md border border-black/10 bg-black/5 px-2 py-1 text-xs opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
        >
          Edit
        </button>
      )}
      <h3 className="mb-2 text-lg font-bold">{title}</h3>
      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            autoFocus
            rows={2}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={`What should change about "${title}"?`}
            className="w-full resize-none rounded-lg border border-black/15 bg-white/70 px-3 py-2 text-sm text-black outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={disabled}
              className="press rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {disabled ? "Applying…" : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="press rounded-md border border-black/15 px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="preview-muted text-sm">
          <BodyWithLinks body={body} onNavigate={onNavigate} />
        </p>
      )}
    </div>
  );
}

export function ProjectPreview({
  state,
  onChange,
}: {
  state: ProjectState;
  onChange: (state: ProjectState) => void;
}) {
  // Fully controlled — the parent owns the single ProjectState, so its
  // change-log panel and this preview can never disagree about what the
  // latest edit actually did. Which page tab is active is genuinely local
  // UI state, so that alone stays here.
  const [activeSlug, setActiveSlug] = useState(state.pages[0]?.slug);
  const [isPending, startTransition] = useTransition();

  const activePage: GeneratedPage | undefined = useMemo(
    () => state.pages.find((p) => p.slug === activeSlug),
    [state.pages, activeSlug]
  );

  function handleEdit(pageSlug: string, sectionKey: string, instruction: string) {
    startTransition(async () => {
      try {
        const updated = await editSectionAction(state, pageSlug, sectionKey, instruction);
        onChange(updated);
        if (updated.status === "failed") {
          toast.error("That edit didn't pass validation — see the failure detail below the preview.");
        } else {
          toast.success("Section updated.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Edit failed.");
      }
    });
  }

  if (!state.tokens) return null;

  const frameStyle = {
    "--preview-bg": state.tokens.colors.background,
    "--preview-surface": state.tokens.colors.surface,
    "--preview-text": state.tokens.colors.text,
    "--preview-text-muted": state.tokens.colors.textMuted,
    "--preview-accent": state.tokens.colors.accent,
    "--preview-font-display": state.tokens.fonts.display,
    "--preview-font-body": state.tokens.fonts.body,
    "--preview-radius": state.tokens.radius,
  } as CSSProperties;

  const latestEntry = state.changeLog[state.changeLog.length - 1];

  return (
    <div>
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(
          state.tokens.fonts.display
        )}:wght@700&family=${encodeURIComponent(state.tokens.fonts.body)}:wght@400;500&display=swap`}
      />

      {state.status === "failed" && (
        <div className="mb-4 rounded-lg border border-red-900 bg-red-950/20 px-4 py-3">
          <p className="text-sm font-semibold text-red-300">
            Last edit failed validation twice — the preview below still shows the last working version, not
            the broken attempt.
          </p>
          {latestEntry?.issues && (
            <ul className="mt-2 space-y-0.5">
              {latestEntry.issues.map((issue, i) => (
                <li key={i} className="font-mono text-xs text-red-400/80">
                  {issue.code}: {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="preview-frame overflow-hidden rounded-2xl border border-neutral-800" style={frameStyle}>
        <div className="flex gap-1 border-b border-black/10 bg-black/5 p-2">
          {state.pages.map((page) => (
            <button
              key={page.slug}
              type="button"
              onClick={() => setActiveSlug(page.slug)}
              className={`press rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                page.slug === activeSlug ? "preview-accent-bg text-white" : "hover:bg-black/5"
              }`}
            >
              {page.title}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-6">
          {activePage?.sections.map((section) => (
            <EditableSection
              key={section.key}
              page={activePage.slug}
              sectionKey={section.key}
              title={section.title}
              body={section.body}
              onSubmitEdit={handleEdit}
              onNavigate={setActiveSlug}
              disabled={isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
