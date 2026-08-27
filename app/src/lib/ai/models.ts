// Model catalog for AI-assisted section drafting. Pricing/IDs current as of
// this writing — verify against Anthropic's docs before relying on the
// numbers shown in the UI, since pricing can change.

export type AiModelId = "claude-haiku-4-5" | "claude-sonnet-5" | "claude-opus-5" | "claude-fable-5";

export interface AiModelInfo {
  id: AiModelId;
  label: string;
  tagline: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  /** Whether this model accepts `output_config.effort` (Haiku 4.5 doesn't — it errors if sent). */
  supportsEffort: boolean;
}

export const AI_MODELS: AiModelInfo[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    tagline: "Fastest and cheapest — good for short, simple sections.",
    inputPricePerMTok: 1,
    outputPricePerMTok: 5,
    supportsEffort: false,
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    tagline: "Balanced quality and cost — the default for most briefs.",
    inputPricePerMTok: 2,
    outputPricePerMTok: 10,
    supportsEffort: true,
  },
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    tagline: "More capable — better for detailed or nuanced briefs.",
    inputPricePerMTok: 5,
    outputPricePerMTok: 25,
    supportsEffort: true,
  },
  {
    id: "claude-fable-5",
    label: "Claude Fable 5",
    tagline: "Anthropic's most capable model — for the most demanding copy.",
    inputPricePerMTok: 10,
    outputPricePerMTok: 50,
    supportsEffort: true,
  },
];

export const DEFAULT_MODEL: AiModelId = "claude-sonnet-5";

export function isAiModelId(value: string): value is AiModelId {
  return AI_MODELS.some((m) => m.id === value);
}

export function getModelInfo(id: AiModelId): AiModelInfo {
  const info = AI_MODELS.find((m) => m.id === id);
  if (!info) throw new Error(`Unknown model: ${id}`);
  return info;
}

/**
 * Recommends a model from a brief's word count alone — a short brief is
 * usually a simple ask a fast/cheap model handles fine; a long, detailed
 * brief has more nuance worth a more capable model getting right. Doesn't
 * default to the priciest tier (Fable 5) — that stays an explicit choice.
 */
export function recommendModel(brief: string): AiModelId {
  const words = brief.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return DEFAULT_MODEL;
  if (words < 12) return "claude-haiku-4-5";
  if (words < 40) return "claude-sonnet-5";
  return "claude-opus-5";
}
