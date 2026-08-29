import Anthropic from "@anthropic-ai/sdk";
import { getModelInfo, type AiModelId } from "./models";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn("ANTHROPIC_API_KEY is not set — AI generation routes will fail until it is.");
}

const client = new Anthropic({ apiKey: apiKey ?? "sk-ant-placeholder" });

export const isAnthropicConfigured = Boolean(apiKey);

export interface GenerateSectionInput {
  model: AiModelId;
  siteName: string;
  siteBrief: string | null;
  sectionTitle: string;
}

const SYSTEM_PROMPT = `You write body copy for one section of a website, for Francisity, an AI site builder.
Write only the section's body text: no heading, no markdown formatting, no preamble, no quotes around it.
Keep it concise (2-4 sentences unless the section clearly calls for a short list), concrete, and specific
to the brief. Never write generic placeholder text.`;

export async function generateSectionDraft(input: GenerateSectionInput): Promise<string> {
  const modelInfo = getModelInfo(input.model);

  const response = await client.messages.create({
    model: input.model,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    ...(modelInfo.supportsEffort ? { output_config: { effort: "medium" as const } } : {}),
    messages: [
      {
        role: "user",
        content: `Site name: ${input.siteName}\nSite brief: ${input.siteBrief ?? "(none given)"}\nSection: ${input.sectionTitle}\n\nWrite the body copy for this section.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to generate this section — try rewording the brief.");
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const text = textBlock?.text.trim();
  if (!text) {
    throw new Error("The model didn't return any text.");
  }
  return text;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatAboutSectionInput {
  model: AiModelId;
  siteName: string;
  siteBrief: string | null;
  sectionTitle: string;
  currentBody: string;
  history: ChatTurn[];
  message: string;
}

export interface ChatAboutSectionResult {
  reply: string;
  body: string;
}

function chatSystemPrompt(input: ChatAboutSectionInput): string {
  return `You are Francisity's AI editor for one section of a website. You're having a back-and-forth
conversation with the site's owner about this section's copy — they ask for a change or give feedback,
you make it. Never write generic placeholder text.

Site name: ${input.siteName}
Site brief: ${input.siteBrief ?? "(none given)"}
Section: ${input.sectionTitle}
Current section body: ${input.currentBody}

Respond with ONLY a JSON object, no markdown code fences, no other text, in exactly this shape:
{"reply": "<one short sentence to the owner describing what you changed, no exclamation marks>", "body": "<the full new section body after applying their request, no heading, no markdown formatting, no quotes around it>"}

If their message doesn't call for a text change (e.g. a question), keep "body" identical to the current
section body above and answer their question in "reply".`;
}

export async function chatAboutSection(input: ChatAboutSectionInput): Promise<ChatAboutSectionResult> {
  const modelInfo = getModelInfo(input.model);

  const response = await client.messages.create({
    model: input.model,
    max_tokens: 800,
    system: chatSystemPrompt(input),
    ...(modelInfo.supportsEffort ? { output_config: { effort: "medium" as const } } : {}),
    messages: [...input.history, { role: "user" as const, content: input.message }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to respond — try rewording your message.");
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const raw = textBlock?.text.trim();
  if (!raw) {
    throw new Error("The model didn't return any text.");
  }

  // Smaller models sometimes wrap the JSON in a markdown code fence despite
  // being told not to — strip it before parsing rather than failing on it.
  const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    throw new Error("The model didn't return a well-formed response — try again.");
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record.reply !== "string" || typeof record.body !== "string") {
    throw new Error("The model's response was missing a reply or body.");
  }

  return { reply: record.reply, body: record.body };
}
