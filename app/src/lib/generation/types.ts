// Checkpoint 1 prototype: the data model behind "persistent, explicit
// project state" (build-prompt point 1) — every generation and fix pass
// reads and writes this, instead of relying on chat history alone.

import type { AiModelId } from "../ai/models";

/** Industry and tone are optional because the dashboard's create form is a
 * single freeform brief ("a coffee roastery in Kyoto…"), not the structured
 * intake the new-build prototype uses — that brief lands in `freeformNotes`
 * instead. `mustHavePages` stays required either way, since validation
 * enforces that every page the brief asked for actually got generated. */
export interface StructuredBrief {
  industry?: string;
  tone?: string;
  mustHavePages: string[];
  brandAssets?: { primaryColor?: string; logoDescription?: string };
  references?: string[];
  freeformNotes?: string;
}

export interface DesignTokens {
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
  };
  fonts: { display: string; body: string };
  radius: string;
}

/** How a section is drawn — not just what it says. Every site used to render
 * every section as the same "kicker + heading + paragraph" block regardless
 * of content, which is why sites with completely different copy and colors
 * still read as the same design. Giving sections a real layout is what
 * actually varies the page's shape. "text" (the default when a section has
 * no layout at all, which covers every already-generated site) is exactly
 * today's block; the rest need `items` (stats/features/list) or
 * `attribution` (quote) to have anything to render beyond a plain block, and
 * fall back to "text" at render time if that's missing — see
 * site-content.ts's sanitizeSection. */
export type SectionLayout = "text" | "cta" | "stats" | "features" | "list" | "quote";

export const SECTION_LAYOUTS: SectionLayout[] = ["text", "cta", "stats", "features", "list", "quote"];

/** One entry in a "stats" (value + label), "features" (title + description),
 * or "list" (label, optionally with a detail line) section. Reused across
 * all three rather than three separate shapes — the prompt just describes
 * `label`/`detail` differently per layout. */
export interface SectionItem {
  label: string;
  detail?: string;
}

export interface PageSection {
  key: string;
  title: string;
  body: string;
  /** Absent on every section generated before this existed — treated as
   * "text" wherever a section is rendered. */
  layout?: SectionLayout;
  /** Only meaningful for "stats" / "features" / "list". */
  items?: SectionItem[];
  /** Only meaningful for "quote" — the speaker's name/role under the quote. */
  attribution?: string;
}

export interface GeneratedPage {
  slug: string;
  title: string;
  sections: PageSection[];
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ChangeLogEntry {
  timestamp: string;
  /** "synthesize" is the ensemble merge step — see generate.ts's
   * resolveHelperModels — that combines multiple providers' independent
   * drafts of the same brief into the one draft that actually gets
   * validated. Absent when only one provider is configured. */
  kind: "generate" | "edit" | "fix" | "validate" | "escalate" | "synthesize";
  summary: string;
  issues?: ValidationIssue[];
  usage?: TokenUsage;
}

export interface ProjectState {
  brief: StructuredBrief;
  model: AiModelId;
  tokens: DesignTokens | null;
  pages: GeneratedPage[];
  changeLog: ChangeLogEntry[];
  status: "generating" | "validated" | "failed";
  totalCostUsd: number;
}

/** What the model is asked to return each pass — the FULL project, never a diff. */
export interface GenerationOutput {
  tokens: DesignTokens;
  pages: GeneratedPage[];
}

/** One turn of a conversation with the AI about a site. Structurally the
 * same shape lib/ai/generate.ts's own ChatTurn used for the (now removed)
 * per-section chat — kept as a separate declaration since the two chat
 * systems are otherwise independent. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
