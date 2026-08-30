// Turning a site's generated design tokens into real CSS. Shared by the
// static export and the published-site renderer so a site someone visits
// and a site someone downloads look identical — one source of truth for
// "what a Francisity site looks like".
//
// Every value is re-validated here rather than interpolated blind: tokens
// come from a language model, land inside a stylesheet, and are served to
// the public, so a malformed one must fall back rather than inject CSS.

import type { DesignTokens } from "@/lib/generation/types";

export const FALLBACK_TOKENS: DesignTokens = {
  colors: {
    background: "#ffffff",
    surface: "#f6f6f6",
    text: "#111111",
    textMuted: "#555555",
    accent: "#3b82f6",
  },
  fonts: { display: "Georgia", body: "Helvetica" },
  radius: "8px",
};

/** Family names are letters, digits, spaces and hyphens — anything else is
 * dropped rather than escaped, since the value goes into both a CSS
 * declaration and a Google Fonts URL. */
export function safeFontFamily(family: string, fallback: string): string {
  const cleaned = family.replace(/[^A-Za-z0-9 -]/g, "").trim();
  return cleaned || fallback;
}

export function safeHex(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function safeLength(value: string, fallback: string): string {
  return /^[0-9]+(\.[0-9]+)?(px|rem|em|%)$/.test(value) ? value : fallback;
}

export interface SafeTokens {
  colors: DesignTokens["colors"];
  displayFont: string;
  bodyFont: string;
  radius: string;
}

export function sanitizeTokens(tokens: DesignTokens | null): SafeTokens {
  const t = tokens ?? FALLBACK_TOKENS;
  return {
    colors: {
      background: safeHex(t.colors.background, FALLBACK_TOKENS.colors.background),
      surface: safeHex(t.colors.surface, FALLBACK_TOKENS.colors.surface),
      text: safeHex(t.colors.text, FALLBACK_TOKENS.colors.text),
      textMuted: safeHex(t.colors.textMuted, FALLBACK_TOKENS.colors.textMuted),
      accent: safeHex(t.colors.accent, FALLBACK_TOKENS.colors.accent),
    },
    displayFont: safeFontFamily(t.fonts.display, FALLBACK_TOKENS.fonts.display),
    bodyFont: safeFontFamily(t.fonts.body, FALLBACK_TOKENS.fonts.body),
    radius: safeLength(t.radius, FALLBACK_TOKENS.radius),
  };
}

export function googleFontsHref(tokens: SafeTokens): string {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    tokens.displayFont
  )}:wght@700&family=${encodeURIComponent(tokens.bodyFont)}:wght@400;500&display=swap`;
}

export function buildSiteCss(tokens: SafeTokens): string {
  return `:root {
  --bg: ${tokens.colors.background};
  --surface: ${tokens.colors.surface};
  --text: ${tokens.colors.text};
  --text-muted: ${tokens.colors.textMuted};
  --accent: ${tokens.colors.accent};
  --radius: ${tokens.radius};
  --font-display: "${tokens.displayFont}", Georgia, serif;
  --font-body: "${tokens.bodyFont}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --max-width: 720px;
}

* { box-sizing: border-box; }

/* Deliberately \`html body\` (specificity 0,0,2) rather than \`body\`: the app's
   own globals.css paints the body black with a noise texture for the
   dashboard, and a published site must win that regardless of which
   stylesheet the framework happens to inject first. The \`background\`
   shorthand is what clears that inherited noise image.

   overflow-x:hidden is what makes the 100vw full-bleed trick below safe —
   without it, 100vw (which includes the scrollbar gutter) can force a few
   pixels of horizontal scroll on desktop. */
html {
  overflow-x: hidden;
}
html body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.6;
  overflow-x: hidden;
}

.site-header, .site-main, .site-footer {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 24px;
}

.site-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-top: 36px;
  padding-bottom: 12px;
}

.site-brand {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
}

.site-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 0.88rem;
}

.site-nav a, .site-nav [aria-current="page"] {
  display: inline-block;
  padding: 5px 12px;
  border-radius: var(--radius);
  text-decoration: none;
}

.site-nav a { color: var(--text-muted); }
.site-nav a:hover { color: var(--text); }
.site-nav [aria-current="page"] { color: var(--bg); background: var(--accent); font-weight: 600; }

/* The page's literal title ("Home", "Contact") is a navigational label, not
   a headline — it reads as a small kicker above the real one, which lives
   in the first section's own heading (see .site-section:first-of-type
   below). This is a deliberate structural choice, not a fallback: it holds
   even when the title IS a good headline, since a kicker over a big
   headline is a normal, legible editorial pattern either way. */
.site-main h1 {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 30px 0 0;
}

.site-section {
  position: relative;
  padding: 28px 0;
}

.site-section h2 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.3rem;
  line-height: 1.25;
  letter-spacing: -0.005em;
  margin: 0 0 12px;
}

.site-section p {
  color: var(--text-muted);
  margin: 0;
  white-space: pre-wrap;
  max-width: 62ch;
}

/* The hero: the first section carries the real headline and gets the most
   air on the page. No card, no border — it's meant to read as the page
   opening, not as one item in a list. */
.site-section:first-of-type {
  padding-top: 4px;
  padding-bottom: 44px;
}
.site-section:first-of-type h2 {
  font-size: clamp(2rem, 5.2vw, 3.25rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-wrap: balance;
  margin: 6px 0 18px;
}
.site-section:first-of-type p {
  font-size: 1.1rem;
  line-height: 1.65;
  max-width: 58ch;
}

/* Every section after the hero: a slim accent rule replaces the old flat
   top hairline (it reads as a deliberate mark, not a leftover divider),
   and alternating full-bleed tint bands give the page rhythm without
   resorting to per-section imagery or a gradient wash. */
.site-section:not(:first-of-type) {
  padding-left: 20px;
  border-left: 3px solid var(--accent);
}
.site-section:not(:first-of-type):nth-of-type(even) {
  border-left-color: transparent;
}
.site-section:not(:first-of-type):nth-of-type(even)::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  background: var(--surface);
  z-index: -1;
}

.site-footer {
  padding: 32px 0 64px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.site-footer a { color: var(--accent); }

@media (max-width: 600px) {
  .site-section:first-of-type h2 { font-size: 1.85rem; }
}

/* ---------- Motion ----------
   Deliberately zero-JavaScript: a published site (and an exported one) has
   no script tag, and adding one to animate would cost more than the polish
   is worth. Only transform and opacity are animated, so everything stays on
   the compositor. */

/* A strong ease-out — the built-in curves are too weak to read as
   intentional. Entrances use ease-out because it moves immediately, which
   is what makes a page feel responsive rather than sluggish. */
.site-header,
.site-main h1 {
  animation: site-rise 620ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
.site-main h1 { animation-delay: 90ms; }

@keyframes site-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}

/* Scroll-driven section reveals, done with a view() timeline so the work
   happens off the main thread with no scroll listener and no observer.

   The opacity:0 lives ONLY inside this @supports block. That is the whole
   point: in a browser without scroll-driven animations the rule never
   applies, so the content is simply visible rather than invisible forever
   waiting for an animation that can't run. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .site-section {
      animation: site-rise linear both;
      animation-timeline: view();
      animation-range: entry 5% cover 22%;
    }
  }
}

/* Micro-interactions. Hover only where there's a real pointer, so a tap on
   a touch device doesn't leave a stuck hover state. */
@media (hover: hover) and (pointer: fine) {
  .site-nav a,
  .site-footer a,
  .site-brand {
    transition: color 180ms ease, opacity 180ms ease;
  }
  .site-brand:hover { opacity: 0.75; }
}

/* Reduced motion means gentler, not absent: the scroll reveal is skipped
   entirely above, and the load entrance becomes a plain fade with no
   movement, which is the vestibular-safe equivalent. */
@media (prefers-reduced-motion: reduce) {
  .site-header,
  .site-main h1 {
    animation: site-fade 200ms ease both;
  }
  @keyframes site-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}
`;
}
