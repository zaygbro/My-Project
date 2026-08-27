import type { SiteSection } from "@/lib/supabase/types";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ExportableSite {
  name: string;
  content: SiteSection[];
  badgeEnabled: boolean;
}

/**
 * Renders a site's structured content into a plain, dependency-free static
 * HTML/CSS pair. Deliberately unopinionated — this is a starting point the
 * owner customizes after export, not a copy of the marketing site's look.
 */
export function renderSiteToStaticFiles(site: ExportableSite): { html: string; css: string } {
  const title = escapeHtml(site.name);

  const sectionsHtml = site.content
    .map(
      (section: SiteSection) => `  <section id="${escapeHtml(section.key)}">
    <h2>${escapeHtml(section.title)}</h2>
    <p>${escapeHtml(section.body)}</p>
  </section>`
    )
    .join("\n");

  const badgeHtml = site.badgeEnabled
    ? `\n  <footer>\n    <a href="https://francisity.com" rel="noopener">Built with Francisity</a>\n  </footer>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header>
  <h1>${title}</h1>
</header>
<main>
${sectionsHtml}
</main>${badgeHtml}
</body>
</html>
`;

  const css = `:root {
  --bg: #ffffff;
  --text: #111111;
  --text-dim: #555555;
  --accent: #3b82f6;
  --max-width: 760px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.6;
}

header, main, footer {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 24px;
}

header {
  padding-top: 64px;
  padding-bottom: 24px;
}

header h1 {
  font-size: 2.25rem;
  margin: 0;
}

section {
  padding: 32px 0;
  border-top: 1px solid #eaeaea;
}

section h2 {
  font-size: 1.25rem;
  margin: 0 0 12px;
}

section p {
  color: var(--text-dim);
  margin: 0;
  white-space: pre-wrap;
}

footer {
  padding: 32px 0 64px;
  font-size: 0.85rem;
  color: var(--text-dim);
}

footer a {
  color: var(--accent);
}
`;

  return { html, css };
}
