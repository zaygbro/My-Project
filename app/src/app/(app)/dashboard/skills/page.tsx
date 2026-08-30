"use client";

import { useMemo, useState } from "react";
import { SKILLS } from "@/lib/skills";

export default function SkillsPage() {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SKILLS;
    return SKILLS.filter((s) => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
  }, [query]);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
    } catch {
      // Clipboard access can be denied by the browser — the button's own
      // label not changing to "Copied" is feedback enough that it didn't
      // work, no need for a second error path.
    }
  }

  return (
    <div className="fade-in-up space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Skills</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-dim">
            The {SKILLS.length} Claude Code skills Francisity&rsquo;s own AI draws on when it builds your site.
            Copy any one into your own chatbot&rsquo;s skills.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            copyText(SKILLS.map((s) => `Skill: ${s.name}\nSource: ${s.source}\n${s.desc}`).join("\n\n"), "all")
          }
          className="press hover-lift shrink-0 rounded-full border border-hairline bg-surface px-4 py-2 font-mono text-xs uppercase tracking-wide text-ink-dim transition-colors hover:border-accent hover:text-white"
        >
          {copied === "all" ? "Copied ✓" : "Copy all"}
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search skills…"
        className="field-transition w-full max-w-sm rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 sm:w-64"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-dim">No skills match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s, i) => (
            <div
              key={s.name}
              className="hover-lift fade-in-up flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:border-ink-faint"
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <p className="break-words font-mono text-[13px] font-bold text-white">{s.name}</p>
              <p className="line-clamp-3 text-sm text-ink-dim">{s.desc}</p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <p className="truncate font-mono text-[11px] text-ink-faint">{s.source}</p>
                <button
                  type="button"
                  onClick={() => copyText(`Skill: ${s.name}\nSource: ${s.source}\n\n${s.desc}`, s.name)}
                  className={`press shrink-0 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                    copied === s.name ? "text-white" : "text-accent hover:text-accent-hover"
                  }`}
                >
                  {copied === s.name ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
