// Checkpoint 1: generate -> validate -> fix (with FULL state, not a diff)
// -> validate -> escalate after 2 failures. This is the concrete, honest
// version of build-prompt point 1 ("no debugging loops") and point 3
// ("production-ready, not just preview-ready") that's actually buildable
// without a live code-execution sandbox: the "build" here is structural
// validation of the generated project against real rules, not a vibe check.
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, type AiModelId } from "../ai/models";
import { validateProject } from "./validate";
import { diffChangedSections } from "../site-content";
import type { ChangeLogEntry, ChatTurn, DesignTokens, GeneratedPage, GenerationOutput, ProjectState, StructuredBrief, TokenUsage } from "./types";

const apiKey = process.env.ANTHROPIC_API_KEY;
export const isGenerationConfigured = Boolean(apiKey);
const client = new Anthropic({ apiKey: apiKey ?? "sk-ant-placeholder" });

function priceUsage(model: AiModelId, inputTokens: number, outputTokens: number): TokenUsage {
  const info = AI_MODELS.find((m) => m.id === model);
  if (!info) throw new Error(`Unknown model: ${model}`);
  const costUsd = (inputTokens / 1_000_000) * info.inputPricePerMTok + (outputTokens / 1_000_000) * info.outputPricePerMTok;
  return { inputTokens, outputTokens, costUsd };
}

function extractJson(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

const SYSTEM_PROMPT = `You generate a small multi-page website's structure and copy for Francisity, an AI site builder for professional designers and agencies.

Respond with ONLY a JSON object, no markdown code fences, no other text, in exactly this shape:
{
  "tokens": {
    "colors": { "background": "#RRGGBB", "surface": "#RRGGBB", "text": "#RRGGBB", "textMuted": "#RRGGBB", "accent": "#RRGGBB" },
    "fonts": { "display": "<a real Google Font family name>", "body": "<a real Google Font family name>" },
    "radius": "<a CSS length like 8px>"
  },
  "pages": [
    { "slug": "<lowercase-hyphenated>", "title": "<page title>", "sections": [ { "key": "<lowercase-key>", "title": "<section heading>", "body": "<real, specific body copy — 2-5 sentences, never generic placeholder text>" } ] }
  ]
}

Hard requirements:
- Generate one page per page named in "Must-have pages", using a slug matching that name (lowercase, spaces to hyphens).
- text and textMuted MUST have strong contrast against background (at least 4.5:1) — pick colors deliberately, not decoratively.
- Never write "Lorem ipsum", "coming soon", "TODO", or any other placeholder — every sentence must be specific to the brief.
- Do not write markdown links to pages you didn't generate.
- Every site is a NEW, FICTIONAL business, even when the brief names a real, existing company (e.g. "a coffee shop like Starbucks", or just "Starbucks"). Never write that real company's actual history, founding story, real store count, real trademarked program names (e.g. a loyalty program named after theirs), or any other verifiable fact about them — that is impersonating a real, identifiable organization, not describing this site's own business. Treat a named real brand only as a style/category reference: invent this business's own name (unless the brief gives one), its own founding story, and its own details in that same space instead.

Design guidance — every generated site is compared against every other AI-generated site, so avoid the handful of choices that make that comparison obvious:
- Never default to the "safe" clichés: a warm cream background (#F4F1EA-ish) with a serif display and a terracotta accent; near-black with one acid-green or vermilion pop; a purple-to-blue gradient; Inter or Space Grotesk as the body/display pair just because they're familiar. Pick colors and fonts that fit THIS business's own category and tone — a bakery, a law firm, and a synth-pop band should never land on the same palette.
- background and surface are choices, not defaults: flat pure white, pure black, or a neutral mid-grey reads as unconsidered. Bias the neutral very slightly toward the accent hue instead.
- display and body should read as a deliberate pair (contrast in weight or character — e.g. a characterful display face with a plain, legible body face), not the same family doing both jobs, and not two faces picked at random.
- The first section on the home page is the site's thesis: lead with the single most concrete, characteristic thing about this specific business, not a generic "Welcome to [name]" opener.
- Only use numbered or step-style section titles ("01 / 02 / 03", "Step 1") when the content is genuinely a sequence — never as decoration.`;

function briefToPrompt(brief: StructuredBrief): string {
  // Industry/tone are omitted entirely rather than printed as "undefined"
  // when the brief came from the dashboard's single freeform field — the
  // model should infer them from the notes instead of being handed a lie.
  return [
    brief.industry ? `Industry: ${brief.industry}` : null,
    brief.tone ? `Tone: ${brief.tone}` : null,
    `Must-have pages: ${brief.mustHavePages.join(", ")}`,
    brief.brandAssets?.primaryColor ? `Preferred primary color: ${brief.brandAssets.primaryColor}` : null,
    brief.brandAssets?.logoDescription ? `Logo/brand description: ${brief.brandAssets.logoDescription}` : null,
    brief.references?.length ? `References: ${brief.references.join("; ")}` : null,
    brief.freeformNotes ? `Brief: ${brief.freeformNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Called with each change-log entry the moment it happens, so a caller can
 * persist progress mid-run and show real "generating → validating → fixing"
 * stages instead of one opaque wait. Awaited, so a slow write can't let the
 * run finish before its own progress lands. */
export type ProgressFn = (entry: ChangeLogEntry) => Promise<void> | void;

/** Called with the actual generated content — tokens and pages — the moment
 * a model call produces it: right after the initial generation, and again
 * after a fix pass if one runs. This is what lets a caller show real content
 * while a run is still in progress, rather than only a change-log label.
 *
 * Deliberately separate from ProgressFn: progress is a log of what
 * happened, this is a snapshot of the current best-known output. Fired even
 * for an UNVALIDATED draft — a live preview during generation is allowed to
 * show something that assurance hasn't cleared yet, since it's clearly
 * marked as in-progress; nothing here bypasses the "never overwrite a
 * working site with a broken edit" rule in editSection, which doesn't use
 * this callback. */
export type DraftFn = (output: GenerationOutput) => Promise<void> | void;

async function emit(
  changeLog: ChangeLogEntry[],
  onProgress: ProgressFn | undefined,
  entry: ChangeLogEntry
): Promise<void> {
  changeLog.push(entry);
  await onProgress?.(entry);
}

async function callModel(
  model: AiModelId,
  system: string,
  userMessage: string
): Promise<{ output: GenerationOutput; usage: TokenUsage }> {
  const modelInfo = AI_MODELS.find((m) => m.id === model)!;
  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system,
    ...(modelInfo.supportsEffort ? { output_config: { effort: "medium" as const } } : {}),
    messages: [{ role: "user", content: userMessage }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to generate this project.");
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const raw = textBlock?.text.trim();
  if (!raw) throw new Error("The model didn't return any text.");

  const parsed = JSON.parse(extractJson(raw)) as GenerationOutput;
  const usage = priceUsage(model, response.usage.input_tokens, response.usage.output_tokens);
  return { output: parsed, usage };
}

/**
 * Shared by initial generation and every edit: validate the FULL project,
 * and if that fails, one fix pass fed the full state plus the specific
 * issues (never a diff), validated again. Two failures in a row and it
 * stops rather than retrying silently — this is the literal build-prompt
 * point 1 rule, applied identically whether the first attempt came from a
 * brand-new brief or a user's edit request.
 */
async function validateAndRecover(
  brief: StructuredBrief,
  output: GenerationOutput,
  model: AiModelId,
  changeLog: ChangeLogEntry[],
  onProgress?: ProgressFn,
  onDraft?: DraftFn
): Promise<{ output: GenerationOutput; status: "validated" | "failed"; costUsd: number }> {
  let costUsd = 0;
  let issues = validateProject(brief, output);
  await emit(changeLog, onProgress, {
    timestamp: new Date().toISOString(),
    kind: "validate",
    summary: issues.length === 0 ? "Passed validation" : `Found ${issues.length} issue(s)`,
    issues,
  });
  if (issues.length === 0) return { output, status: "validated", costUsd };

  const fixPrompt = `The project has validation issues. Here is the FULL current project state:
${JSON.stringify(output, null, 2)}

Validation issues found:
${issues.map((i) => `- [${i.code}] ${i.message}`).join("\n")}

Return the FULL corrected project (same JSON shape as before) with every issue resolved. Do not just patch the flagged spot — make sure the whole project is still internally consistent after your fix.`;

  const fixResult = await callModel(model, SYSTEM_PROMPT, fixPrompt);
  costUsd += fixResult.usage.costUsd;
  await emit(changeLog, onProgress, {
    timestamp: new Date().toISOString(),
    kind: "fix",
    summary: "Fix pass for validation issues",
    issues,
    usage: fixResult.usage,
  });
  // The fix pass changed the content, so a live preview watching the draft
  // needs this update too — otherwise it would keep showing the pre-fix
  // version (with the issues visible above) after the fix already landed.
  await onDraft?.(fixResult.output);

  issues = validateProject(brief, fixResult.output);
  await emit(changeLog, onProgress, {
    timestamp: new Date().toISOString(),
    kind: "validate",
    summary: issues.length === 0 ? "Passed validation after fix" : `Still has ${issues.length} issue(s) after fix`,
    issues,
  });
  if (issues.length === 0) return { output: fixResult.output, status: "validated", costUsd };

  // Failed validation twice in a row: stop and surface it, rather than
  // silently retrying and burning cost (build-prompt point 1, explicit).
  await emit(changeLog, onProgress, {
    timestamp: new Date().toISOString(),
    kind: "escalate",
    summary: "Failed validation twice in a row — stopping instead of retrying silently.",
    issues,
  });
  return { output: fixResult.output, status: "failed", costUsd };
}

export async function generateProject(
  brief: StructuredBrief,
  model: AiModelId = "claude-haiku-4-5",
  onProgress?: ProgressFn,
  onDraft?: DraftFn
): Promise<ProjectState> {
  const changeLog: ChangeLogEntry[] = [];

  const { output, usage } = await callModel(model, SYSTEM_PROMPT, briefToPrompt(brief));
  await emit(changeLog, onProgress, {
    timestamp: new Date().toISOString(),
    kind: "generate",
    summary: "Initial generation",
    usage,
  });
  // The very first real content — a live preview can start rendering the
  // actual site now instead of waiting for validation/fix to finish too.
  await onDraft?.(output);

  const recovered = await validateAndRecover(brief, output, model, changeLog, onProgress, onDraft);

  return {
    brief,
    model,
    tokens: recovered.output.tokens,
    pages: recovered.output.pages,
    changeLog,
    status: recovered.status,
    totalCostUsd: usage.costUsd + recovered.costUsd,
  };
}

/**
 * A single section-level edit. Reuses the exact same validate/fix/escalate
 * machinery as initial generation. Critically: if the edit ends up
 * "failed", the returned state's pages/tokens are the PRIOR validated
 * content, not the broken attempt — a failed edit can never overwrite a
 * working preview with something unvalidated (build-prompt point 3: never
 * let "looks done" imply "works"). The attempt itself, and exactly why it
 * failed, is still fully visible in the change log.
 */
export async function editSection(
  state: ProjectState,
  pageSlug: string,
  sectionKey: string,
  instruction: string,
  onProgress?: ProgressFn
): Promise<ProjectState> {
  if (!state.tokens) throw new Error("Cannot edit a project that hasn't been validated yet.");
  const changeLog = [...state.changeLog];
  const currentOutput: GenerationOutput = { tokens: state.tokens, pages: state.pages };

  const editPrompt = `Current full project state:
${JSON.stringify(currentOutput, null, 2)}

Requested change — page "${pageSlug}", section "${sectionKey}": ${instruction}

Apply ONLY this change. Keep every other page and section exactly as-is unless the request genuinely requires a related update (e.g. a shared design token). Return the FULL updated project in the same JSON shape as before.`;

  const { output, usage } = await callModel(state.model, SYSTEM_PROMPT, editPrompt);
  await emit(changeLog, onProgress, {
    timestamp: new Date().toISOString(),
    kind: "edit",
    summary: `Edit requested on "${sectionKey}" (${pageSlug}): "${instruction}"`,
    usage,
  });

  const recovered = await validateAndRecover(state.brief, output, state.model, changeLog, onProgress);
  const isGood = recovered.status === "validated";

  return {
    brief: state.brief,
    model: state.model,
    tokens: isGood ? recovered.output.tokens : state.tokens,
    pages: isGood ? recovered.output.pages : state.pages,
    changeLog,
    status: recovered.status,
    totalCostUsd: state.totalCostUsd + usage.costUsd + recovered.costUsd,
  };
}

const CHAT_EDIT_SYSTEM_PROMPT = `You are Francisity's AI editor, having a conversation with the owner of a
site you already built. You can see the site's entire current content below. When the owner asks for a
change, decide which section(s) actually need to change and rewrite them; when you don't know enough to do
that well, ask one short clarifying question instead of guessing or writing generic filler.

Respond with ONLY a JSON object, no markdown code fences, no other text, in exactly this shape:
{
  "reply": "<what you say back to the owner — a short clarifying question, or one short sentence describing what you changed, no exclamation marks>",
  "pages": <the FULL updated pages array (same shape as the current pages below) with your changes applied, or null if you are only asking a question and changed nothing>,
  "tokens": <the FULL updated tokens object (same shape as the current tokens below), ONLY when the owner asked for a visual/design change (colors, fonts, radius, "make it feel more X", "upgrade the UI") — omit this field or set it to null for a content-only change>
}

Rules:
- Never add, remove, or rename a page, or change a page's slug — only edit, add, or remove SECTIONS within the existing pages.
- You CAN change design tokens (colors, fonts, radius) when the owner is asking for that — a visual request is not out of scope, so don't deflect it to a content suggestion instead. text and textMuted must keep at least 4.5:1 contrast against background. Pick real Google Font family names, not the same face for both display and body, and avoid the obvious AI-generated defaults (cream background with a terracotta accent, near-black with one neon accent, a purple-to-blue gradient, Inter or Space Grotesk as a reflexive pair) unless the owner specifically asks for one of those looks.
- When you DO make a content change, return every page, not just the one(s) you touched — the response replaces the whole pages array. The same applies to tokens: return the complete object, not a partial patch.
- Never write "Lorem ipsum", generic placeholder text, or anything not specific to this business.
- New or rewritten copy should read as this specific business, not marketing-in-general — a concrete detail beats a generic claim. Don't add numbered or step-style titles ("01", "Step 1") unless the content is genuinely a sequence.
- This is a fictional business. Even if the brief or a page names a real, existing company, never write that real company's actual history, facts, or trademarks — a named real brand is a style reference only, never something to describe truthfully.`;

interface ChatEditModelResult {
  reply: string;
  pages: GeneratedPage[] | null;
  tokens: DesignTokens | null;
}

async function callChatModel(model: AiModelId, userMessage: string): Promise<{ result: ChatEditModelResult; usage: TokenUsage }> {
  const modelInfo = AI_MODELS.find((m) => m.id === model)!;
  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system: CHAT_EDIT_SYSTEM_PROMPT,
    ...(modelInfo.supportsEffort ? { output_config: { effort: "medium" as const } } : {}),
    messages: [{ role: "user", content: userMessage }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to respond — try rewording your message.");
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const raw = textBlock?.text.trim();
  if (!raw) throw new Error("The model didn't return any text.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error("The model didn't return a well-formed response — try again.");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.reply !== "string") {
    throw new Error("The model's response was missing a reply.");
  }

  const usage = priceUsage(model, response.usage.input_tokens, response.usage.output_tokens);
  return {
    result: {
      reply: record.reply,
      pages: Array.isArray(record.pages) ? (record.pages as GeneratedPage[]) : null,
      tokens: record.tokens && typeof record.tokens === "object" ? (record.tokens as DesignTokens) : null,
    },
    usage,
  };
}

export interface ChatEditResult {
  reply: string;
  projectState: ProjectState;
  /** "pageSlug/sectionKey" refs touched by this turn — empty when the model
   * only asked a question, made no real change, or the edit failed
   * validation and was discarded. */
  changedRefs: string[];
  /** Whether this turn changed design tokens (colors/fonts/radius) — kept
   * separate from changedRefs since a tokens-only change (no section edits)
   * would otherwise show up as no change at all. */
  tokensChanged: boolean;
}

/**
 * One turn of the single, site-wide AI chat: the model sees the FULL current
 * site and decides for itself which section(s) need to change, rather than
 * being scoped in advance to one section the way editSection is. Reuses
 * validateAndRecover — the exact same validate/fix/escalate machinery as
 * generation and editSection — so a chat-driven edit gets the identical
 * safety guarantee: if it fails validation twice, the site keeps its PRIOR
 * working content, not the broken attempt.
 */
export async function chatEditProject(
  state: ProjectState,
  history: ChatTurn[],
  message: string,
  onProgress?: ProgressFn
): Promise<ChatEditResult> {
  if (!state.tokens) throw new Error("Cannot chat about a project that hasn't been validated yet.");
  const changeLog = [...state.changeLog];

  const conversation = [
    ...history.map((turn) => `${turn.role === "user" ? "Owner" : "You"}: ${turn.content}`),
    `Owner: ${message}`,
  ].join("\n\n");

  const userMessage = `Current site (shown for context; include an updated "tokens" object in your response only if the owner is asking for a visual/design change):
${JSON.stringify({ tokens: state.tokens, pages: state.pages }, null, 2)}

Conversation so far:
${conversation}

Respond to the owner's latest message.`;

  const { result, usage } = await callChatModel(state.model, userMessage);

  if (!result.pages && !result.tokens) {
    // A clarifying question — nothing to validate or persist as content.
    await emit(changeLog, onProgress, {
      timestamp: new Date().toISOString(),
      kind: "edit",
      summary: `Asked a clarifying question in response to: "${message}"`,
      usage,
    });
    return {
      reply: result.reply,
      projectState: { ...state, changeLog, totalCostUsd: state.totalCostUsd + usage.costUsd },
      changedRefs: [],
      tokensChanged: false,
    };
  }

  await emit(changeLog, onProgress, {
    timestamp: new Date().toISOString(),
    kind: "edit",
    summary: `Chat edit requested: "${message}"`,
    usage,
  });

  const nextTokens = result.tokens ?? state.tokens;
  const nextPages = result.pages ?? state.pages;
  const recovered = await validateAndRecover(
    state.brief,
    { tokens: nextTokens, pages: nextPages },
    state.model,
    changeLog,
    onProgress
  );
  const isGood = recovered.status === "validated";
  const changedRefs = isGood ? diffChangedSections(state.pages, recovered.output.pages) : [];
  const tokensChanged = isGood && result.tokens !== null;

  return {
    reply: isGood
      ? result.reply
      : `${result.reply} (That edit didn't pass validation, so I've kept your site as it was — see the build log below for exactly what was wrong.)`,
    projectState: {
      ...state,
      tokens: isGood ? recovered.output.tokens : state.tokens,
      pages: isGood ? recovered.output.pages : state.pages,
      changeLog,
      totalCostUsd: state.totalCostUsd + usage.costUsd + recovered.costUsd,
    },
    changedRefs,
    tokensChanged,
  };
}
