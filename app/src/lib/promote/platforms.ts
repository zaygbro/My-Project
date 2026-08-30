// Where a promo video can go, and what each place actually requires.
//
// These are format constraints, not opinions: they decide the aspect ratio
// the video is generated at and the length the script is written to, so
// getting them wrong produces an ad that can't be posted. Platforms do
// change their limits, so every entry carries a link to the official docs
// rather than asking anyone to trust this file forever.

export type PlatformId = "tiktok" | "reels" | "shorts" | "x" | "linkedin";

export interface Platform {
  id: PlatformId;
  label: string;
  /** Aspect ratio the video should be generated at. */
  aspect: "9:16" | "16:9" | "1:1";
  /** Target length in seconds — what the script is written to fill. */
  targetSeconds: number;
  /** Hard ceiling the platform enforces on an upload, in seconds. */
  maxSeconds: number;
  /** Character budget for the caption/post that goes with the video. */
  captionLimit: number;
  /** Whether hashtags are conventional on this platform. */
  hashtags: boolean;
  /** How the audience arrives — steers the script's opening. */
  audience: string;
  uploadSteps: string[];
  docsUrl: string;
  docsLabel: string;
}

export const PLATFORMS: Record<PlatformId, Platform> = {
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    aspect: "9:16",
    targetSeconds: 15,
    maxSeconds: 600,
    captionLimit: 2200,
    hashtags: true,
    audience: "scrolling a feed, sound on, will leave in under two seconds if the opening is slow",
    uploadSteps: [
      "Open TikTok and tap the + button, then Upload to pick your video file.",
      "Trim if needed, then tap Next.",
      "Paste the caption below. Keep the link in your bio — TikTok captions aren't clickable.",
      "Set cover frame to the strongest visual moment, not the first frame.",
      "Tap Post.",
    ],
    docsUrl: "https://support.tiktok.com/en/using-tiktok/creating-videos",
    docsLabel: "TikTok creator help",
  },
  reels: {
    id: "reels",
    label: "Instagram Reels",
    aspect: "9:16",
    targetSeconds: 15,
    maxSeconds: 90,
    captionLimit: 2200,
    hashtags: true,
    audience: "scrolling Reels, often sound off first — on-screen text has to carry the message",
    uploadSteps: [
      "In Instagram, tap + then Reel, and select your video file.",
      "Tap Next, then paste the caption below.",
      "Instagram captions aren't clickable — put the site link in your profile and say “link in bio”.",
      "Pick a cover frame, then tap Share.",
    ],
    docsUrl: "https://help.instagram.com/270447560766967",
    docsLabel: "Instagram Reels help",
  },
  shorts: {
    id: "shorts",
    label: "YouTube Shorts",
    aspect: "9:16",
    targetSeconds: 20,
    maxSeconds: 60,
    captionLimit: 100,
    hashtags: true,
    audience: "searching or browsing Shorts — the title does as much work as the video",
    uploadSteps: [
      "Go to youtube.com/upload (or the mobile app's + button) and select your video.",
      "A vertical video under 60 seconds is published as a Short automatically.",
      "Use the short title below — Shorts titles are capped at 100 characters.",
      "Put the full site link in the description, where it is clickable.",
      "Set visibility to Public and publish.",
    ],
    docsUrl: "https://support.google.com/youtube/answer/10059070",
    docsLabel: "YouTube Shorts help",
  },
  x: {
    id: "x",
    label: "X",
    aspect: "16:9",
    targetSeconds: 20,
    maxSeconds: 140,
    captionLimit: 280,
    hashtags: false,
    audience: "reading a timeline — the post text is the hook, the video is the proof",
    uploadSteps: [
      "Start a new post and attach your video file.",
      "Paste the post text below. The link is clickable here, so include it.",
      "One or two hashtags at most — more reads as spam on X.",
      "Post.",
    ],
    docsUrl: "https://help.x.com/en/using-x/x-videos",
    docsLabel: "X video help",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    aspect: "1:1",
    targetSeconds: 30,
    maxSeconds: 600,
    captionLimit: 3000,
    hashtags: true,
    audience: "professionals skimming a feed — credibility matters more than spectacle",
    uploadSteps: [
      "From your feed, click Start a post, then the video icon, and select your file.",
      "Paste the post text below. Links are clickable, but LinkedIn favours posts that keep people on-platform — consider putting the link in the first comment.",
      "Add up to three relevant hashtags.",
      "Click Post.",
    ],
    docsUrl: "https://www.linkedin.com/help/linkedin/answer/a548558",
    docsLabel: "LinkedIn video help",
  },
};

export const PLATFORM_LIST: Platform[] = Object.values(PLATFORMS);

/** Object.hasOwn, not `in`: `in` walks the prototype chain, so `"toString"`
 * and `"constructor"` would pass this check and then resolve to a function
 * instead of a Platform. This guards a value that arrives straight from a
 * submitted form field. */
export function isPlatformId(value: string): value is PlatformId {
  return Object.hasOwn(PLATFORMS, value);
}

/** Video models that can render a promo from a text prompt alone, with the
 * app IDs the inference.sh `belt` CLI expects. */
export interface VideoModel {
  id: string;
  label: string;
  note: string;
  /** Whether the model can produce sound as well as picture. */
  audio: boolean;
}

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: "google/veo-3-1-fast",
    label: "Veo 3.1 Fast",
    note: "Quick and cheap, optional audio — good default for a first pass.",
    audio: true,
  },
  {
    id: "google/veo-3-1",
    label: "Veo 3.1",
    note: "Best quality; slower and pricier.",
    audio: true,
  },
  {
    id: "bytedance/seedance-2-0",
    label: "Seedance 2.0",
    note: "Up to 1080p with synced audio.",
    audio: true,
  },
  {
    id: "bytedance/seedance-2-0-fast",
    label: "Seedance 2.0 Fast",
    note: "Same capabilities, faster and cheaper.",
    audio: true,
  },
  {
    id: "alibaba/happyhorse-1-0-t2v",
    label: "HappyHorse 1.0",
    note: "Physically realistic motion, up to 15s.",
    audio: false,
  },
  {
    id: "xai/grok-imagine-video",
    label: "Grok Imagine",
    note: "Configurable duration.",
    audio: false,
  },
];

/** The exact command to render a prompt with the inference.sh CLI. Shell
 * metacharacters in the prompt are escaped, since this is copied straight
 * into a terminal. */
export function beltCommand(modelId: string, prompt: string, seconds: number, audio: boolean): string {
  const input = JSON.stringify({
    prompt,
    duration: seconds,
    ...(audio ? { generate_audio: true } : {}),
  });
  // Single-quote the JSON for the shell, escaping any embedded single quote
  // the model may have written into the prompt.
  const quoted = `'${input.replace(/'/g, `'\\''`)}'`;
  return `belt app run ${modelId} --input ${quoted}`;
}
