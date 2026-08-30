// Model catalog for AI-assisted section drafting. Pricing/IDs current as of
// this writing — verify against each provider's docs before relying on the
// numbers shown in the UI (or the model ID strings themselves for the newer
// OpenAI/Google entries), since both can change.

export type AiProvider = "anthropic" | "openai" | "google";

export type AiModelId =
  | "claude-haiku-4-5"
  | "claude-sonnet-5"
  | "claude-opus-5"
  | "claude-fable-5"
  | "gpt-5"
  | "gemini-3-pro";

export interface AiModelInfo {
  id: AiModelId;
  provider: AiProvider;
  label: string;
  tagline: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  /** Whether this model accepts `output_config.effort` (Anthropic-only — Haiku 4.5 doesn't, it errors if sent). */
  supportsEffort: boolean;
}

export const AI_MODELS: AiModelInfo[] = [
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    label: "Claude Haiku 4.5",
    tagline: "Fastest and cheapest — good for short, simple sections.",
    inputPricePerMTok: 1,
    outputPricePerMTok: 5,
    supportsEffort: false,
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    label: "Claude Sonnet 5",
    tagline: "Balanced quality and cost — the default for most briefs.",
    inputPricePerMTok: 2,
    outputPricePerMTok: 10,
    supportsEffort: true,
  },
  {
    id: "claude-opus-5",
    provider: "anthropic",
    label: "Claude Opus 5",
    tagline: "More capable — better for detailed or nuanced briefs.",
    inputPricePerMTok: 5,
    outputPricePerMTok: 25,
    supportsEffort: true,
  },
  {
    id: "claude-fable-5",
    provider: "anthropic",
    label: "Claude Fable 5",
    tagline: "Anthropic's most capable model — for the most demanding copy.",
    inputPricePerMTok: 10,
    outputPricePerMTok: 50,
    supportsEffort: true,
  },
  {
    id: "gpt-5",
    provider: "openai",
    label: "GPT-5",
    tagline: "OpenAI's flagship — a strong second opinion alongside Claude.",
    inputPricePerMTok: 1.25,
    outputPricePerMTok: 10,
    supportsEffort: false,
  },
  {
    id: "gemini-3-pro",
    provider: "google",
    label: "Gemini 3 Pro",
    tagline: "Google's flagship — a third independent take on the same brief.",
    inputPricePerMTok: 2,
    outputPricePerMTok: 12,
    supportsEffort: false,
  },
];

export const DEFAULT_MODEL: AiModelId = "claude-sonnet-5";

export const ALL_PROVIDERS: AiProvider[] = ["anthropic", "openai", "google"];

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

/** The one model each provider contributes when it's brought in as a helper
 * alongside someone else's chosen main model — see resolveHelperModels. */
export const FLAGSHIP_MODEL_BY_PROVIDER: Record<AiProvider, AiModelId> = {
  anthropic: "claude-fable-5",
  openai: "gpt-5",
  google: "gemini-3-pro",
};

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

/**
 * The owner picks one "main" model; every OTHER provider that's actually
 * configured contributes its own flagship as a helper, so the main model can
 * draw on independent drafts from providers it doesn't share a lineage with
 * (Claude never gets "helped" by another Claude tier — a second opinion from
 * the same lab isn't a second opinion). Pure and env-free so it's easy to
 * test: the caller decides what "configured" means (checking API keys) and
 * just hands in the resulting set.
 */
export function resolveHelperModels(main: AiModelId, configuredProviders: ReadonlySet<AiProvider>): AiModelId[] {
  const mainProvider = getModelInfo(main).provider;
  return ALL_PROVIDERS.filter((p) => p !== mainProvider && configuredProviders.has(p)).map(
    (p) => FLAGSHIP_MODEL_BY_PROVIDER[p]
  );
}
