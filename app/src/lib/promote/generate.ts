import Anthropic from "@anthropic-ai/sdk";
import { getModelInfo, type AiModelId } from "@/lib/ai/models";
import type { DesignTokens, GeneratedPage } from "@/lib/generation/types";
import { PLATFORMS, type PlatformId } from "./platforms";

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = new Anthropic({ apiKey: apiKey ?? "sk-ant-placeholder" });

export const isPromoteConfigured = Boolean(apiKey);

export interface Shot {
  seconds: number;
  visual: string;
  onScreenText: string;
}

export interface AdScript {
  hook: string;
  shots: Shot[];
  videoPrompt: string;
  caption: string;
  hashtags: string[];
  shortTitle: string;
}

export interface WriteAdInput {
  model: AiModelId;
  platform: PlatformId;
  siteName: string;
  siteBrief: string | null;
  pages: GeneratedPage[];
  tokens: DesignTokens | null;
  siteUrl: string | null;
}

function systemPrompt(input: WriteAdInput): string {
  const p = PLATFORMS[input.platform];
  const palette = input.tokens
    ? `The site's own palette is background ${input.tokens.colors.background}, accent ${input.tokens.colors.accent}, text ${input.tokens.colors.text}, with ${input.tokens.fonts.display} for headings. The video should look like it belongs to that site.`
    : "";

  return `You write short video ads for real small businesses, for Francisity, an AI site builder.

You are advertising this specific site — use its real content, never invent products, prices, claims,
awards, or statistics it doesn't support. If the site's copy doesn't establish something, don't say it.

Target: ${p.label}. The viewer is ${p.audience}.
Length: about ${p.targetSeconds} seconds total. Aspect ratio ${p.aspect}.
${palette}

Respond with ONLY a JSON object, no markdown code fences, no other text, in exactly this shape:
{
  "hook": "<the first line/visual that stops the scroll, under 12 words>",
  "shots": [
    { "seconds": <number>, "visual": "<what is on screen>", "onScreenText": "<the text overlay, under 8 words>" }
  ],
  "videoPrompt": "<a single self-contained prompt for a text-to-video model: describe the scene, camera movement, lighting, mood and pacing in one paragraph. Describe only what a camera can see. Do NOT mention text overlays, logos, captions, UI, or the brand name — those are added afterwards, and video models render written words badly.>",
  "caption": "<the post text, at most ${p.captionLimit} characters${input.siteUrl && (input.platform === "x" || input.platform === "linkedin" || input.platform === "shorts") ? `, and include the URL ${input.siteUrl}` : ", with no URL since links aren't clickable on this platform"}>",
  "hashtags": [${p.hashtags ? '"<without the # symbol>"' : ""}],
  "shortTitle": "<a title under 100 characters, used for YouTube Shorts>"
}

Rules:
- The shots' seconds must add up to roughly ${p.targetSeconds}.
- ${p.hashtags ? "Give 3-6 hashtags that a real person searching for this business would use. No generic #viral #fyp filler." : "Return an empty hashtags array — hashtags don't help on this platform."}
- Write plainly. No exclamation marks, no "unleash", "elevate", "game-changing", or ad-speak.
- ${p.captionLimit <= 300 ? `The caption is HARD capped at ${p.captionLimit} characters — count them.` : "Keep the caption tight; front-load the point in the first line."}`;
}

function siteSummary(input: WriteAdInput): string {
  const content = input.pages
    .map((page) => `## ${page.title}\n${page.sections.map((s) => `${s.title}: ${s.body}`).join("\n")}`)
    .join("\n\n");

  return `Site name: ${input.siteName}
Brief it was built from: ${input.siteBrief ?? "(none given)"}
${input.siteUrl ? `Live URL: ${input.siteUrl}` : "Not published yet."}

Its real content:
${content}

Write the ad.`;
}

export async function writeAdScript(input: WriteAdInput): Promise<AdScript> {
  const modelInfo = getModelInfo(input.model);

  const response = await client.messages.create({
    model: input.model,
    max_tokens: 1500,
    system: systemPrompt(input),
    ...(modelInfo.supportsEffort ? { output_config: { effort: "medium" as const } } : {}),
    messages: [{ role: "user", content: siteSummary(input) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to write this ad — try rewording your site's copy.");
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const raw = textBlock?.text.trim();
  if (!raw) throw new Error("The model didn't return any text.");

  const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    throw new Error("The model didn't return a well-formed ad — try again.");
  }

  const record = parsed as Record<string, unknown>;
  if (
    typeof record.hook !== "string" ||
    typeof record.videoPrompt !== "string" ||
    typeof record.caption !== "string" ||
    !Array.isArray(record.shots)
  ) {
    throw new Error("The model's response was missing part of the ad.");
  }

  const limit = PLATFORMS[input.platform].captionLimit;

  return {
    hook: record.hook,
    shots: (record.shots as Shot[]).filter(
      (s) => s && typeof s.visual === "string" && typeof s.seconds === "number"
    ),
    videoPrompt: record.videoPrompt,
    // Enforce the platform's cap here rather than trusting the model to have
    // counted — a caption that's one character over is rejected at upload
    // time, which is a worse place to find out.
    caption: record.caption.length > limit ? `${record.caption.slice(0, limit - 1)}…` : record.caption,
    hashtags: Array.isArray(record.hashtags)
      ? (record.hashtags as unknown[]).filter((h): h is string => typeof h === "string").slice(0, 6)
      : [],
    shortTitle:
      typeof record.shortTitle === "string" ? record.shortTitle.slice(0, 100) : input.siteName,
  };
}
