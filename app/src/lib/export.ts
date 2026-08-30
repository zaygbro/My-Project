import type { DesignTokens, GeneratedPage, PageSection } from "@/lib/generation/types";
import { buildSiteCss, googleFontsHref, sanitizeTokens } from "@/lib/site-theme";
import { sanitizeSection } from "@/lib/site-content";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Static-HTML-string counterpart to components/site/SiteSection.tsx — same
 * layouts, same sanitizeSection call, just built as an escaped string
 * instead of JSX since a static export has no React runtime to render one. */
function renderSection(section: PageSection): string {
  const safe = sanitizeSection(section);
  const heading = `<h2>${escapeHtml(safe.title)}</h2>`;
  const body = safe.body ? `<p>${escapeHtml(safe.body)}</p>` : "";

  switch (safe.layout) {
    case "stats":
      return `    <section id="${escapeHtml(safe.key)}" class="site-section site-section-stats">
      ${heading}
      ${body}
      <div class="site-items">
${safe.items
  .map(
    (item) => `        <div class="site-stat">
          <span class="site-stat-value">${escapeHtml(item.label)}</span>
${item.detail ? `          <span class="site-stat-detail">${escapeHtml(item.detail)}</span>\n` : ""}        </div>`
  )
  .join("\n")}
      </div>
    </section>`;

    case "features":
      return `    <section id="${escapeHtml(safe.key)}" class="site-section site-section-features">
      ${heading}
      ${body}
      <div class="site-items">
${safe.items
  .map(
    (item) => `        <div class="site-feature">
          <span class="site-feature-title">${escapeHtml(item.label)}</span>
${item.detail ? `          <span class="site-feature-detail">${escapeHtml(item.detail)}</span>\n` : ""}        </div>`
  )
  .join("\n")}
      </div>
    </section>`;

    case "list":
      return `    <section id="${escapeHtml(safe.key)}" class="site-section site-section-list">
      ${heading}
      ${body}
      <ul class="site-list">
${safe.items
  .map(
    (item) => `        <li>
          <span class="site-list-label">${escapeHtml(item.label)}</span>
${item.detail ? `          <span class="site-list-detail">${escapeHtml(item.detail)}</span>\n` : ""}        </li>`
  )
  .join("\n")}
      </ul>
    </section>`;

    case "quote":
      return `    <section id="${escapeHtml(safe.key)}" class="site-section site-section-quote">
      ${heading}
      <blockquote class="site-quote">
        <p>${escapeHtml(safe.body)}</p>
${safe.attribution ? `        <cite class="site-quote-attribution">${escapeHtml(safe.attribution)}</cite>\n` : ""}      </blockquote>
    </section>`;

    case "cta":
      return `    <section id="${escapeHtml(safe.key)}" class="site-section site-section-cta">
      ${heading}
      ${body}
    </section>`;

    default:
      return `    <section id="${escapeHtml(safe.key)}" class="site-section">
      ${heading}
      ${body}
    </section>`;
  }
}

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

/**
 * One HTML file per page (the first becomes index.html) plus a shared
 * stylesheet built from the site's own generated design tokens.
 *
 * The markup and CSS come from the same `site-theme` module the published
 * renderer uses, so a downloaded site and a live one can't drift apart.
 * Dependency-free: no build step, no framework, no CDN JS.
 */
export function renderSiteToStaticFiles(site: ExportableSite): ExportedFile[] {
  const tokens = sanitizeTokens(site.tokens);
  const title = escapeHtml(site.name);

  // The first page is the site's entry point, so it ships as index.html and
  // every nav link to it points at "index.html" rather than its own slug.
  const pages = site.pages.length > 0 ? site.pages : [{ slug: "index", title: site.name, sections: [] }];
  const fileFor = (slug: string) => (slug === pages[0].slug ? "index.html" : `${slug}.html`);

  const files: ExportedFile[] = pages.map((page) => {
    const nav = pages
      .map((p) =>
        p.slug === page.slug
          ? `        <span aria-current="page">${escapeHtml(p.title)}</span>`
          : `        <a href="${escapeHtml(fileFor(p.slug))}">${escapeHtml(p.title)}</a>`
      )
      .join("\n");

    const sections = page.sections.map(renderSection).join("\n");

    const badge = site.badgeEnabled
      ? `\n  <footer class="site-footer">\n    <a href="https://francisity.com" rel="noopener">Built with Francisity</a>\n  </footer>`
      : "";

    const contents = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)} — ${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${escapeHtml(googleFontsHref(tokens))}">
<link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="site-header">
    <a class="site-brand" href="index.html">${title}</a>
${pages.length > 1 ? `    <nav class="site-nav">\n${nav}\n    </nav>` : ""}
  </header>
  <main class="site-main">
    <h1>${escapeHtml(page.title)}</h1>
${sections}
  </main>${badge}
</body>
</html>
`;
    return { path: fileFor(page.slug), contents };
  });

  files.push({ path: "styles.css", contents: buildSiteCss(tokens) });
  return files;
}
