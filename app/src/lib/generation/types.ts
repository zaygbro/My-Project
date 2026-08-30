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

export interface PageSection {
  key: string;
  title: string;
  body: string;
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
  kind: "generate" | "edit" | "fix" | "validate" | "escalate";
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
