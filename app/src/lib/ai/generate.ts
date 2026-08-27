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
