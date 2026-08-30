// Checkpoint 1: generate -> validate -> fix (with FULL state, not a diff)
// -> validate -> escalate after 2 failures. This is the concrete, honest
// version of build-prompt point 1 ("no debugging loops") and point 3
// ("production-ready, not just preview-ready") that's actually buildable
// without a live code-execution sandbox: the "build" here is structural
// validation of the generated project against real rules, not a vibe check.
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import {
  ALL_PROVIDERS,
  getModelInfo,
  resolveHelperModels,
  type AiModelId,
  type AiModelInfo,
  type AiProvider,
} from "../ai/models";
import { validateProject } from "./validate";
import { diffChangedSections } from "../site-content";
import type { ChangeLogEntry, ChatTurn, DesignTokens, GeneratedPage, GenerationOutput, ProjectState, StructuredBrief, TokenUsage } from "./types";

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY;

const anthropicClient = new Anthropic({ apiKey: anthropicApiKey ?? "sk-ant-placeholder" });
const openaiClient = new OpenAI({ apiKey: openaiApiKey ?? "sk-placeholder" });
const googleClient = new GoogleGenAI({ apiKey: googleApiKey ?? "placeholder" });

export function isProviderConfigured(provider: AiProvider): boolean {
  switch (provider) {
    case "anthropic":
      return Boolean(anthropicApiKey);
    case "openai":
      return Boolean(openaiApiKey);
    case "google":
      return Boolean(googleApiKey);
  }
}

/** True as soon as ONE provider is configured — the whole app's "is AI on at
 * all" gate. Which specific models are actually available to a given
 * generation is a separate question, answered per-call by
 * resolveHelperModels + isProviderConfigured. */
export const isGenerationConfigured = ALL_PROVIDERS.some(isProviderConfigured);

function priceUsage(model: AiModelId, inputTokens: number, outputTokens: number): TokenUsage {
  const info = getModelInfo(model);
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
    { "slug": "<lowercase-hyphenated>", "title": "<page title>", "sections": [
      { "key": "<lowercase-key>", "title": "<section heading>", "body": "<real, specific body copy — 2-5 sentences, never generic placeholder text>", "layout": "<one of: text, cta, stats, features, list, quote>" }
    ] }
  ]
}

A section's "layout" is optional in the schema but NOT optional in practice — see "Vary the layout" below for what each one means and why picking real ones is the actual job.

Only "stats", "features", and "list" sections take an "items" array: { "key", "title", "body", "layout": "stats", "items": [ { "label": "<a value>", "detail": "<optional caption>" } ] } — "features"/"list" need at least 2/1 real items ("stats" needs at least 2). Only "quote" sections take "attribution": { "key", "title", "body": "<the quote itself>", "layout": "quote", "attribution": "<name, role>" } — attribution is optional. Every other layout ignores both fields entirely; don't include them.

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
- The first section on the home page is the site's thesis: lead with the single most concrete, characteristic thing about this specific business, not a generic "Welcome to [name]" opener. Its layout should almost always be "text" — a hero is an opening statement, not a stat block.
- Only use numbered or step-style section titles ("01 / 02 / 03", "Step 1") when the content is genuinely a sequence — never as decoration.
- Vary the layout — this is what makes two sites with different content actually LOOK different, not just read different. Choosing "text" for every section is the single biggest reason AI-generated sites end up looking identical to each other regardless of their colors or copy: pick the layout each section's own content actually calls for, not the same block six times.
  - "stats": the business has real numbers worth calling out (years running, customers served, response time, capacity, ratings).
  - "features": several distinct things worth comparing side by side (services offered, product lines, amenities, plans) — each item is its own short label + one-line description, not a paragraph.
  - "list": a sequence or enumeration (how it works, a menu, what's included) where order or a flat rundown matters more than prose.
  - "quote": a testimonial, review, or a specific person's voice belongs in the site (only when the brief or content genuinely supports one — never invent a fake named reviewer with fabricated specifics presented as verifiable; write it as illustrative, not as attributed-to-a-real-person evidence).
  - "cta": a closing section whose entire job is to prompt the next action — keep it short.
  - "text": the default for anything that's genuinely just prose (an about/story section, a policy, general context) — this should still be a normal fraction of the page, not fill it end to end.
  - A typical page should use at least two or three DIFFERENT layouts across its sections, not one layout repeated for every section on it.`;

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

interface RawModelResult {
  raw: string;
  usage: TokenUsage;
}

async function callAnthropicRaw(
  model: AiModelId,
  modelInfo: AiModelInfo,
  system: string,
  userMessage: string,
  refusalMessage: string
): Promise<RawModelResult> {
  const response = await anthropicClient.messages.create({
    model,
    max_tokens: 4000,
    system,
    ...(modelInfo.supportsEffort ? { output_config: { effort: "medium" as const } } : {}),
    messages: [{ role: "user", content: userMessage }],
  });

  if (response.stop_reason === "refusal") throw new Error(refusalMessage);

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const raw = textBlock?.text.trim();
  if (!raw) throw new Error("The model didn't return any text.");

  return { raw, usage: priceUsage(model, response.usage.input_tokens, response.usage.output_tokens) };
}

async function callOpenAiRaw(
  model: AiModelId,
  system: string,
  userMessage: string,
  refusalMessage: string
): Promise<RawModelResult> {
  const response = await openaiClient.chat.completions.create({
    model,
    max_completion_tokens: 4000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ],
  });

  const choice = response.choices[0];
  if (choice?.finish_reason === "content_filter") throw new Error(refusalMessage);

  const raw = choice?.message?.content?.trim();
  if (!raw) throw new Error("The model didn't return any text.");

  const usage = priceUsage(model, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0);
  return { raw, usage };
}

async function callGoogleRaw(model: AiModelId, system: string, userMessage: string): Promise<RawModelResult> {
  const response = await googleClient.models.generateContent({
    model,
    contents: userMessage,
    config: { systemInstruction: system, maxOutputTokens: 4000 },
  });

  const raw = response.text?.trim();
  if (!raw) throw new Error("The model didn't return any text.");

  const usage = priceUsage(
    model,
    response.usageMetadata?.promptTokenCount ?? 0,
    response.usageMetadata?.candidatesTokenCount ?? 0
  );
  return { raw, usage };
}

/** Every model call, from every provider, funnels through here — the rest of
 * this file (generation, fix passes, edits, chat) never touches a provider
 * SDK directly, so adding or swapping a provider only ever changes this one
 * dispatch. */
async function callRawModel(
  model: AiModelId,
  system: string,
  userMessage: string,
  refusalMessage = "The model declined to respond."
): Promise<RawModelResult> {
  const modelInfo = getModelInfo(model);
  switch (modelInfo.provider) {
    case "anthropic":
      return callAnthropicRaw(model, modelInfo, system, userMessage, refusalMessage);
    case "openai":
      return callOpenAiRaw(model, system, userMessage, refusalMessage);
    case "google":
      // Google's API has no equivalent "refused to answer" finish reason
      // exposed the same way — a refusal just comes back as normal (if
      // evasive) text, so there's nothing to special-case here.
      return callGoogleRaw(model, system, userMessage);
  }
}

async function callModel(
  model: AiModelId,
  system: string,
  userMessage: string
): Promise<{ output: GenerationOutput; usage: TokenUsage }> {
  const { raw, usage } = await callRawModel(model, system, userMessage, "The model declined to generate this project.");
  const output = JSON.parse(extractJson(raw)) as GenerationOutput;
  return { output, usage };
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

/** Anonymized so the model judges content, not brand names — telling it
 * "this draft is from GPT-5" invites deference or bias neither draft earned
 * on its own merits. */
function buildSynthesisPrompt(brief: StructuredBrief, drafts: GenerationOutput[]): string {
  const letters = ["A", "B", "C", "D"];
  const draftsText = drafts.map((d, i) => `Draft ${letters[i]}:\n${JSON.stringify(d, null, 2)}`).join("\n\n");
  return `${briefToPrompt(brief)}

Multiple independent AI models each generated a full draft of this exact same brief, shown below. Produce ONE final version that is better than any single draft alone: combine the strongest choices across all of them — the most specific and concrete copy, the best-fitting color palette and type pairing, the most fitting layout choice per section — into one coherent, internally consistent site. Don't just pick one draft wholesale unless it is genuinely the strongest on every count; you're expected to blend improvements from more than one draft when that produces a better result. The result must read as a single coherent voice and design, not a visible patchwork of styles.

${draftsText}

Return the FULL final project in the exact same JSON shape as before (see the schema above) — not a diff, not a comparison, not commentary.`;
}

/**
 * Runs the initial draft. When the owner's chosen main model is the only
 * configured provider, this is exactly one call — unchanged from before this
 * feature existed. The moment a second provider's key is ALSO set,
 * resolveHelperModels brings in that provider's own flagship to draft the
 * same brief independently, and the main model gets a follow-up call to
 * merge the strongest choices from every draft that came back into one
 * final, coherent version (see buildSynthesisPrompt) — this is the "AIs work
 * together" behavior: the owner still only ever picks one main model, extra
 * providers only ever help it, never replace it.
 */
async function runInitialGeneration(
  brief: StructuredBrief,
  model: AiModelId,
  changeLog: ChangeLogEntry[],
  onProgress: ProgressFn | undefined,
  onDraft: DraftFn | undefined
): Promise<{ output: GenerationOutput; costUsd: number }> {
  const helpers = resolveHelperModels(model, new Set(ALL_PROVIDERS.filter(isProviderConfigured)));
  const prompt = briefToPrompt(brief);

  if (helpers.length === 0) {
    const { output, usage } = await callModel(model, SYSTEM_PROMPT, prompt);
    await emit(changeLog, onProgress, { timestamp: new Date().toISOString(), kind: "generate", summary: "Initial generation", usage });
    await onDraft?.(output);
    return { output, costUsd: usage.costUsd };
  }

  const draftModels = [model, ...helpers];
  const settled = await Promise.allSettled(draftModels.map((m) => callModel(m, SYSTEM_PROMPT, prompt)));

  let costUsd = 0;
  const drafts: { model: AiModelId; output: GenerationOutput }[] = [];
  for (let i = 0; i < settled.length; i++) {
    const draftModel = draftModels[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      costUsd += result.value.usage.costUsd;
      drafts.push({ model: draftModel, output: result.value.output });
      await emit(changeLog, onProgress, {
        timestamp: new Date().toISOString(),
        kind: "generate",
        summary: `Draft from ${getModelInfo(draftModel).label}${draftModel === model ? " (your chosen main model)" : ""}`,
        usage: result.value.usage,
      });
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : "unknown error";
      await emit(changeLog, onProgress, {
        timestamp: new Date().toISOString(),
        kind: "generate",
        summary: `Draft from ${getModelInfo(draftModel).label} failed (${reason}) — continuing without it`,
      });
    }
  }

  if (drafts.length === 0) throw new Error("Every configured model failed to generate a draft.");

  // Show something real immediately: the main model's own draft if it came
  // back, otherwise whichever draft did.
  await onDraft?.((drafts.find((d) => d.model === model) ?? drafts[0]).output);

  if (drafts.length === 1) return { output: drafts[0].output, costUsd };

  const { output, usage } = await callModel(model, SYSTEM_PROMPT, buildSynthesisPrompt(brief, drafts.map((d) => d.output)));
  costUsd += usage.costUsd;
  await emit(changeLog, onProgress, {
    timestamp: new Date().toISOString(),
    kind: "synthesize",
    summary: `Combined the best of ${drafts.length} independent drafts into one site`,
    usage,
  });
  await onDraft?.(output);
  return { output, costUsd };
}

export async function generateProject(
  brief: StructuredBrief,
  model: AiModelId = "claude-haiku-4-5",
  onProgress?: ProgressFn,
  onDraft?: DraftFn
): Promise<ProjectState> {
  const changeLog: ChangeLogEntry[] = [];

  const { output, costUsd } = await runInitialGeneration(brief, model, changeLog, onProgress, onDraft);

  const recovered = await validateAndRecover(brief, output, model, changeLog, onProgress, onDraft);

  return {
    brief,
    model,
    tokens: recovered.output.tokens,
    pages: recovered.output.pages,
    changeLog,
    status: recovered.status,
    totalCostUsd: costUsd + recovered.costUsd,
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
  "options": <2-4 short strings (a few words each) the owner can click instead of typing, or null — see "Offering options" below>,
  "pages": <the FULL updated pages array (same shape as the current pages below) with your changes applied, or null if you are only asking a question and changed nothing>,
  "tokens": <the FULL updated tokens object (same shape as the current tokens below), ONLY when the owner asked for a visual/design change (colors, fonts, radius, "make it feel more X", "upgrade the UI") — omit this field or set it to null for a content-only change>
}

Offering options: most people asking for a site edit aren't developers and won't reach for precise terms — when your reply is a clarifying question with a small number of natural, concrete answers, spell those answers out as "options" so the owner can just click one instead of having to phrase a reply themselves. Example: asking whether to write vivid drink descriptions or restyle the menu visually becomes options ["Write vivid descriptions", "Restyle it visually"], not left for the owner to type out. Set "options" to null when the reply isn't a question, when you're only confirming a change you already made, or when the real answers are open-ended (a name, a number, freeform text) rather than a short natural list — never invent artificial choices just to have some.

Each section can also carry a "layout" ("text", "cta", "stats", "features", "list", or "quote" — absent/"text" is a plain heading+paragraph block) plus, only where that layout needs them, an "items" array ({ "label", "detail"? } — "stats" needs 2+, "features" needs 2+, "list" needs 1+) or a "quote" section's "attribution". Changing a section's layout — "make this a stats section", "turn the reviews into a proper list" — is a legitimate, in-scope edit, exactly like a wording change: update that section's "layout" (and its "items"/"attribution" if the new layout needs them) in the pages you return.

Rules:
- Never add, remove, or rename a page, or change a page's slug — only edit, add, or remove SECTIONS within the existing pages.
- You CAN change design tokens (colors, fonts, radius) when the owner is asking for that — a visual request is not out of scope, so don't deflect it to a content suggestion instead. text and textMuted must keep at least 4.5:1 contrast against background. Pick real Google Font family names, not the same face for both display and body, and avoid the obvious AI-generated defaults (cream background with a terracotta accent, near-black with one neon accent, a purple-to-blue gradient, Inter or Space Grotesk as a reflexive pair) unless the owner specifically asks for one of those looks.
- When you DO make a content change, return every page, not just the one(s) you touched — the response replaces the whole pages array. The same applies to tokens: return the complete object, not a partial patch.
- Never write "Lorem ipsum", generic placeholder text, or anything not specific to this business.
- New or rewritten copy should read as this specific business, not marketing-in-general — a concrete detail beats a generic claim. Don't add numbered or step-style titles ("01", "Step 1") unless the content is genuinely a sequence.
- This is a fictional business. Even if the brief or a page names a real, existing company, never write that real company's actual history, facts, or trademarks — a named real brand is a style reference only, never something to describe truthfully.`;

interface ChatEditModelResult {
  reply: string;
  options: string[];
  pages: GeneratedPage[] | null;
  tokens: DesignTokens | null;
}

/** Model output is untrusted the same way a section's own content is (see
 * site-content.ts's sanitizeSection) — a non-array, non-string entries, or
 * an implausibly long list all get cleaned up rather than handed to the UI
 * as-is. Capped at 4: any more stops reading as a short list of real
 * choices and starts looking like the model padding out a menu. */
export function sanitizeOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length === 4) break;
  }
  return out;
}

async function callChatModel(model: AiModelId, userMessage: string): Promise<{ result: ChatEditModelResult; usage: TokenUsage }> {
  const { raw, usage } = await callRawModel(
    model,
    CHAT_EDIT_SYSTEM_PROMPT,
    userMessage,
    "The model declined to respond — try rewording your message."
  );

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

  return {
    result: {
      reply: record.reply,
      options: sanitizeOptions(record.options),
      pages: Array.isArray(record.pages) ? (record.pages as GeneratedPage[]) : null,
      tokens: record.tokens && typeof record.tokens === "object" ? (record.tokens as DesignTokens) : null,
    },
    usage,
  };
}

export interface ChatEditResult {
  reply: string;
  /** Short clickable answers to this turn's reply, when it was a
   * multiple-choice-shaped clarifying question — empty otherwise. Ephemeral
   * by design: only ever shown for the reply that just arrived, never
   * persisted to site_messages, so reloading the chat or scrolling back to
   * an old question doesn't resurrect stale buttons for a question that's
   * moved on. */
  options: string[];
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
      options: result.options,
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
    // The reply text gets rewritten above when validation fails, so any
    // options tied to the original reply no longer match what's actually
    // being said — only surface them alongside a reply that shipped as-is.
    options: isGood ? result.options : [],
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
