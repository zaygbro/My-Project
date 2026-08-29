// Checkpoint 1: generate -> validate -> fix (with FULL state, not a diff)
// -> validate -> escalate after 2 failures. This is the concrete, honest
// version of build-prompt point 1 ("no debugging loops") and point 3
// ("production-ready, not just preview-ready") that's actually buildable
// without a live code-execution sandbox: the "build" here is structural
// validation of the generated project against real rules, not a vibe check.
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, type AiModelId } from "../ai/models";
import { validateProject } from "./validate";
import type { ChangeLogEntry, GenerationOutput, ProjectState, StructuredBrief, TokenUsage } from "./types";

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
- Do not write markdown links to pages you didn't generate.`;

function briefToPrompt(brief: StructuredBrief): string {
  return `Industry: ${brief.industry}
Tone: ${brief.tone}
Must-have pages: ${brief.mustHavePages.join(", ")}
${brief.brandAssets?.primaryColor ? `Preferred primary color: ${brief.brandAssets.primaryColor}\n` : ""}${brief.brandAssets?.logoDescription ? `Logo/brand description: ${brief.brandAssets.logoDescription}\n` : ""}${brief.references?.length ? `References: ${brief.references.join("; ")}\n` : ""}${brief.freeformNotes ? `Notes: ${brief.freeformNotes}\n` : ""}`;
}

async function callModel(model: AiModelId, userMessage: string): Promise<{ output: GenerationOutput; usage: TokenUsage }> {
  const modelInfo = AI_MODELS.find((m) => m.id === model)!;
  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
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

export async function generateProject(brief: StructuredBrief, model: AiModelId = "claude-haiku-4-5"): Promise<ProjectState> {
  const changeLog: ChangeLogEntry[] = [];
  let totalCostUsd = 0;

  const { output, usage } = await callModel(model, briefToPrompt(brief));
  totalCostUsd += usage.costUsd;
  changeLog.push({ timestamp: new Date().toISOString(), kind: "generate", summary: "Initial generation", usage });

  let issues = validateProject(brief, output);
  changeLog.push({
    timestamp: new Date().toISOString(),
    kind: "validate",
    summary: issues.length === 0 ? "Passed validation" : `Found ${issues.length} issue(s)`,
    issues,
  });

  if (issues.length === 0) {
    return { brief, tokens: output.tokens, pages: output.pages, changeLog, status: "validated", totalCostUsd };
  }

  // One fix pass, given the FULL current state plus the specific issues —
  // never just "here's the one error, patch it" (that's exactly the pattern
  // that lets a fix silently reintroduce something else that was fine).
  const fixPrompt = `The project you generated has validation issues. Here is the FULL current project state:
${JSON.stringify(output, null, 2)}

Validation issues found:
${issues.map((i) => `- [${i.code}] ${i.message}`).join("\n")}

Return the FULL corrected project (same JSON shape as before) with every issue resolved. Do not just patch the flagged spot — make sure the whole project is still internally consistent after your fix.`;

  const fixResult = await callModel(model, fixPrompt);
  totalCostUsd += fixResult.usage.costUsd;
  changeLog.push({
    timestamp: new Date().toISOString(),
    kind: "fix",
    summary: "Fix pass for validation issues",
    issues,
    usage: fixResult.usage,
  });

  issues = validateProject(brief, fixResult.output);
  changeLog.push({
    timestamp: new Date().toISOString(),
    kind: "validate",
    summary: issues.length === 0 ? "Passed validation after fix" : `Still has ${issues.length} issue(s) after fix`,
    issues,
  });

  if (issues.length === 0) {
    return {
      brief,
      tokens: fixResult.output.tokens,
      pages: fixResult.output.pages,
      changeLog,
      status: "validated",
      totalCostUsd,
    };
  }

  // Failed validation twice in a row: stop and surface it, rather than
  // silently retrying and burning cost (build-prompt point 1, explicit).
  changeLog.push({
    timestamp: new Date().toISOString(),
    kind: "escalate",
    summary: "Failed validation twice in a row — stopping instead of retrying silently.",
    issues,
  });

  return {
    brief,
    tokens: fixResult.output.tokens,
    pages: fixResult.output.pages,
    changeLog,
    status: "failed",
    totalCostUsd,
  };
}
