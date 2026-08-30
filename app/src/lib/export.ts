import type { DesignTokens, GeneratedPage } from "@/lib/generation/types";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A generated font family goes into a CSS declaration and a Google Fonts
 * URL, so it has to survive both without being able to close a quote or
 * smuggle in another declaration. Family names are letters, digits, spaces
 * and hyphens — anything else is dropped rather than escaped. */
function safeFontFamily(family: string, fallback: string): string {
  const cleaned = family.replace(/[^A-Za-z0-9 -]/g, "").trim();
  return cleaned || fallback;
}

/** Same idea for colors and lengths: only ever emit a value we've confirmed
 * is the shape we expect, so a malformed token can't inject CSS. */
function safeHex(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function safeLength(value: string, fallback: string): string {
  return /^[0-9]+(\.[0-9]+)?(px|rem|em|%)$/.test(value) ? value : fallback;
}

const FALLBACK_TOKENS: DesignTokens = {
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

export interface ExportableSite {
  name: string;
  pages: GeneratedPage[];
  tokens: DesignTokens | null;
  badgeEnabled: boolean;
}

export interface ExportedFile {
  path: string;
  contents: string;
}

/** One HTML file per page (the first page becomes index.html) plus a shared
 * stylesheet built from the site's own generated design tokens — so an
 * exported site looks like what the dashboard previewed, not a generic
 * default. Dependency-free: no build step, no framework, no CDN JS. */
export function renderSiteToStaticFiles(site: ExportableSite): ExportedFile[] {
  const tokens = site.tokens ?? FALLBACK_TOKENS;
  const title = escapeHtml(site.name);

  const colors = {
    background: safeHex(tokens.colors.background, FALLBACK_TOKENS.colors.background),
    surface: safeHex(tokens.colors.surface, FALLBACK_TOKENS.colors.surface),
    text: safeHex(tokens.colors.text, FALLBACK_TOKENS.colors.text),
    textMuted: safeHex(tokens.colors.textMuted, FALLBACK_TOKENS.colors.textMuted),
    accent: safeHex(tokens.colors.accent, FALLBACK_TOKENS.colors.accent),
  };
  const displayFont = safeFontFamily(tokens.fonts.display, FALLBACK_TOKENS.fonts.display);
  const bodyFont = safeFontFamily(tokens.fonts.body, FALLBACK_TOKENS.fonts.body);
  const radius = safeLength(tokens.radius, FALLBACK_TOKENS.radius);

  // The first page is the site's entry point, so it ships as index.html and
  // every nav link to it points at "index.html" rather than its own slug.
  const pages = site.pages.length > 0 ? site.pages : [{ slug: "index", title: site.name, sections: [] }];
  const fileFor = (slug: string) => (slug === pages[0].slug ? "index.html" : `${slug}.html`);

  const fontsHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    displayFont
  )}:wght@700&family=${encodeURIComponent(bodyFont)}:wght@400;500&display=swap`;

  const files: ExportedFile[] = pages.map((page) => {
    const nav = pages
      .map((p) =>
        p.slug === page.slug
          ? `      <span aria-current="page">${escapeHtml(p.title)}</span>`
          : `      <a href="${escapeHtml(fileFor(p.slug))}">${escapeHtml(p.title)}</a>`
      )
      .join("\n");

    const sections = page.sections
      .map(
        (section) => `    <section id="${escapeHtml(section.key)}">
      <h2>${escapeHtml(section.title)}</h2>
      <p>${escapeHtml(section.body)}</p>
    </section>`
      )
      .join("\n");

    const badge = site.badgeEnabled
      ? `\n  <footer>\n    <a href="https://francisity.com" rel="noopener">Built with Francisity</a>\n  </footer>`
      : "";

    const contents = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)} — ${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${escapeHtml(fontsHref)}">
<link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <a class="brand" href="index.html">${title}</a>
${pages.length > 1 ? `    <nav>\n${nav}\n    </nav>` : ""}
  </header>
  <main>
    <h1>${escapeHtml(page.title)}</h1>
${sections}
  </main>${badge}
</body>
</html>
`;
    return { path: fileFor(page.slug), contents };
  });

  const css = `:root {
  --bg: ${colors.background};
  --surface: ${colors.surface};
  --text: ${colors.text};
  --text-muted: ${colors.textMuted};
  --accent: ${colors.accent};
  --radius: ${radius};
  --font-display: "${displayFont}", Georgia, serif;
  --font-body: "${bodyFont}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --max-width: 760px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.6;
}

header, main, footer {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 24px;
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-top: 32px;
  padding-bottom: 8px;
}

.brand {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 0.9rem;
}

nav a { color: var(--text-muted); text-decoration: none; }
nav a:hover { color: var(--accent); }
nav [aria-current="page"] { color: var(--accent); font-weight: 500; }

main h1 {
  font-family: var(--font-display);
  font-size: 2.25rem;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 32px 0 8px;
}

section {
  padding: 32px 0;
  border-top: 1px solid var(--surface);
}

section h2 {
  font-family: var(--font-display);
  font-size: 1.25rem;
  margin: 0 0 12px;
}

section p {
  color: var(--text-muted);
  margin: 0;
  white-space: pre-wrap;
}

footer {
  padding: 32px 0 64px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

footer a { color: var(--accent); }

@media (max-width: 600px) {
  main h1 { font-size: 1.75rem; }
}
`;

  files.push({ path: "styles.css", contents: css });
  return files;
}
