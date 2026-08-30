// Unit tests for the pure pieces of the multi-page generation wire-up.
// These need no database and no API key, so they actually run in CI (and in
// a sandbox) — unlike anything that touches Supabase or Anthropic.
//
//   npx tsx scripts/test-site-content.ts

import assert from "node:assert/strict";
import {
  deriveMustHavePages,
  diffChangedSections,
  findSection,
  replaceSectionBody,
  sanitizeSection,
  sectionRef,
} from "../src/lib/site-content";
import { renderSiteToStaticFiles } from "../src/lib/export";
import { sanitizeOptions } from "../src/lib/generation/generate";
import { validateProject } from "../src/lib/generation/validate";
import {
  normalizeSubdomain,
  publishedUrl,
  suggestSubdomain,
  validateSubdomain,
} from "../src/lib/publish";
import { buildSiteCss, sanitizeTokens } from "../src/lib/site-theme";
import { validatePassword } from "../src/lib/password";
import { safeNextPath } from "../src/lib/redirects";
import { PLATFORM_LIST, beltCommand, isPlatformId } from "../src/lib/promote/platforms";
import type { DesignTokens, GeneratedPage, PageSection, StructuredBrief } from "../src/lib/generation/types";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const pages: GeneratedPage[] = [
  {
    slug: "index",
    title: "Home",
    sections: [
      { key: "intro", title: "Intro", body: "Home intro." },
      { key: "cta", title: "Call to action", body: "Book a table." },
    ],
  },
  {
    slug: "about",
    title: "About",
    // Deliberately the same section key as on Home — this is the exact
    // collision that made page-scoping necessary.
    sections: [{ key: "intro", title: "Intro", body: "About intro." }],
  },
];

console.log("\nderiveMustHavePages");
test("defaults to a three-page site", () => {
  assert.deepEqual(deriveMustHavePages("a coffee roastery in Kyoto"), ["Home", "About", "Contact"]);
});
test("respects an explicit landing-page brief", () => {
  assert.deepEqual(deriveMustHavePages("a landing page for my app"), ["Home"]);
});
test("respects one-pager phrasing and is case-insensitive", () => {
  assert.deepEqual(deriveMustHavePages("A One-Pager for a wedding"), ["Home"]);
  assert.deepEqual(deriveMustHavePages("single page site"), ["Home"]);
});
test("does not match 'page' inside an unrelated word", () => {
  // "homepage" shouldn't collapse a normal brief down to one page.
  assert.deepEqual(deriveMustHavePages("a site with a nice homepage and a blog"), [
    "Home",
    "About",
    "Contact",
  ]);
});
test("returns a fresh array each call (callers must not share state)", () => {
  const a = deriveMustHavePages("x");
  a.push("Extra");
  assert.deepEqual(deriveMustHavePages("x"), ["Home", "About", "Contact"]);
});

console.log("\nfindSection / sectionRef");
test("finds a section scoped to its own page", () => {
  assert.equal(findSection(pages, "index", "intro")?.body, "Home intro.");
  assert.equal(findSection(pages, "about", "intro")?.body, "About intro.");
});
test("returns undefined for a section that isn't on that page", () => {
  assert.equal(findSection(pages, "about", "cta"), undefined);
  assert.equal(findSection(pages, "nope", "intro"), undefined);
});
test("sectionRef namespaces by page", () => {
  assert.equal(sectionRef("about", "intro"), "about/intro");
  assert.notEqual(sectionRef("index", "intro"), sectionRef("about", "intro"));
});

console.log("\nreplaceSectionBody");
test("replaces only the targeted page's section", () => {
  const next = replaceSectionBody(pages, "about", "intro", "NEW");
  assert.equal(findSection(next, "about", "intro")?.body, "NEW");
  assert.equal(findSection(next, "index", "intro")?.body, "Home intro.");
});
test("does not mutate the original (version snapshots depend on this)", () => {
  const before = JSON.stringify(pages);
  replaceSectionBody(pages, "index", "intro", "MUTATED");
  assert.equal(JSON.stringify(pages), before);
});
test("is a no-op for an unknown page or section", () => {
  assert.deepEqual(replaceSectionBody(pages, "ghost", "intro", "X"), pages);
  assert.deepEqual(replaceSectionBody(pages, "index", "ghost", "X"), pages);
});

console.log("\ndiffChangedSections");
test("detects a changed body", () => {
  const after = replaceSectionBody(pages, "index", "cta", "NEW CTA");
  assert.deepEqual(diffChangedSections(pages, after), ["index/cta"]);
});
test("detects a changed title too, not just body", () => {
  const after = pages.map((p) =>
    p.slug === "about" ? { ...p, sections: [{ ...p.sections[0], title: "New Title" }] } : p
  );
  assert.deepEqual(diffChangedSections(pages, after), ["about/intro"]);
});
test("detects a brand-new section", () => {
  const after = pages.map((p) =>
    p.slug === "about" ? { ...p, sections: [...p.sections, { key: "hours", title: "Hours", body: "9-5" }] } : p
  );
  assert.deepEqual(diffChangedSections(pages, after), ["about/hours"]);
});
test("reports nothing when nothing changed", () => {
  assert.deepEqual(diffChangedSections(pages, pages), []);
});
test("two sections changing across two different pages both show up", () => {
  let after = replaceSectionBody(pages, "index", "intro", "NEW HOME");
  after = replaceSectionBody(after, "about", "intro", "NEW ABOUT");
  assert.deepEqual(diffChangedSections(pages, after).sort(), ["about/intro", "index/intro"]);
});
test("detects a layout change even when body and title stay the same", () => {
  const after = pages.map((p) =>
    p.slug === "index"
      ? { ...p, sections: p.sections.map((s) => (s.key === "cta" ? { ...s, layout: "cta" as const } : s)) }
      : p
  );
  assert.deepEqual(diffChangedSections(pages, after), ["index/cta"]);
});

console.log("\nsanitizeSection");
test("defaults to text when layout is absent", () => {
  const s: PageSection = { key: "a", title: "T", body: "B" };
  assert.deepEqual(sanitizeSection(s), { key: "a", title: "T", body: "B", layout: "text", items: [], attribution: null });
});
test("falls back to text for an unrecognized layout string", () => {
  const s = { key: "a", title: "T", body: "B", layout: "carousel" } as unknown as PageSection;
  assert.equal(sanitizeSection(s).layout, "text");
});
test("keeps a stats section with enough real items", () => {
  const s: PageSection = {
    key: "a",
    title: "T",
    body: "B",
    layout: "stats",
    items: [{ label: "500+", detail: "customers" }, { label: "12", detail: "years" }],
  };
  const safe = sanitizeSection(s);
  assert.equal(safe.layout, "stats");
  assert.deepEqual(safe.items, [{ label: "500+", detail: "customers" }, { label: "12", detail: "years" }]);
});
test("falls back to text when a stats section has too few items", () => {
  const s: PageSection = { key: "a", title: "T", body: "B", layout: "stats", items: [{ label: "500+" }] };
  const safe = sanitizeSection(s);
  assert.equal(safe.layout, "text");
  assert.deepEqual(safe.items, []);
});
test("a single real item is enough for a list section", () => {
  const s: PageSection = { key: "a", title: "T", body: "B", layout: "list", items: [{ label: "Step one" }] };
  assert.equal(sanitizeSection(s).layout, "list");
});
test("drops malformed items (missing/blank label) instead of throwing", () => {
  const s = {
    key: "a",
    title: "T",
    body: "B",
    layout: "features",
    items: [{ label: "Real" }, { label: "   " }, { detail: "no label at all" }, null, "not an object"],
  } as unknown as PageSection;
  const safe = sanitizeSection(s);
  // Only one real item survives, which is below the 2-item minimum for
  // "features" — so this also exercises the same fallback-to-text path.
  assert.equal(safe.layout, "text");
});
test("trims whitespace on item label/detail", () => {
  const s: PageSection = {
    key: "a",
    title: "T",
    body: "B",
    layout: "list",
    items: [{ label: "  Padded  ", detail: "  also padded  " }],
  };
  assert.deepEqual(sanitizeSection(s).items, [{ label: "Padded", detail: "also padded" }]);
});
test("ignores a non-array items value instead of throwing", () => {
  const s = { key: "a", title: "T", body: "B", layout: "list", items: "not an array" } as unknown as PageSection;
  assert.equal(sanitizeSection(s).layout, "text");
});
test("keeps a quote's attribution when present", () => {
  const s: PageSection = { key: "a", title: "T", body: "Great place.", layout: "quote", attribution: "Jane, regular" };
  const safe = sanitizeSection(s);
  assert.equal(safe.layout, "quote");
  assert.equal(safe.attribution, "Jane, regular");
});
test("a quote with no attribution renders without one, not a fallback", () => {
  const s: PageSection = { key: "a", title: "T", body: "Great place." };
  const withQuote = { ...s, layout: "quote" as const };
  const safe = sanitizeSection(withQuote);
  assert.equal(safe.layout, "quote");
  assert.equal(safe.attribution, null);
});
test("attribution is ignored on every layout except quote", () => {
  const s: PageSection = { key: "a", title: "T", body: "B", layout: "text", attribution: "Someone" };
  assert.equal(sanitizeSection(s).attribution, null);
});
test("cta and text carry no items even if the model included some", () => {
  const s: PageSection = { key: "a", title: "T", body: "B", layout: "cta", items: [{ label: "x" }, { label: "y" }] };
  assert.deepEqual(sanitizeSection(s).items, []);
});

console.log("\nvalidateProject — section layouts");
const layoutBrief: StructuredBrief = { mustHavePages: ["Home"] };
const layoutTokens: DesignTokens = {
  colors: { background: "#ffffff", surface: "#f0f0f0", text: "#000000", textMuted: "#444444", accent: "#3b82f6" },
  fonts: { display: "Georgia", body: "Helvetica" },
  radius: "8px",
};
test("flags a stats section declared with too few items", () => {
  const issues = validateProject(layoutBrief, {
    tokens: layoutTokens,
    pages: [
      {
        slug: "index",
        title: "Home",
        sections: [{ key: "s", title: "By the numbers", body: "Some context.", layout: "stats", items: [{ label: "1" }] }],
      },
    ],
  });
  assert.ok(issues.some((i) => i.code === "missing-section-items"));
});
test("passes a stats section with enough items", () => {
  const issues = validateProject(layoutBrief, {
    tokens: layoutTokens,
    pages: [
      {
        slug: "index",
        title: "Home",
        sections: [
          {
            key: "s",
            title: "By the numbers",
            body: "Some context.",
            layout: "stats",
            items: [{ label: "1" }, { label: "2" }],
          },
        ],
      },
    ],
  });
  assert.ok(!issues.some((i) => i.code === "missing-section-items"));
});
test("a plain text section is never flagged for missing items", () => {
  const issues = validateProject(layoutBrief, {
    tokens: layoutTokens,
    pages: [{ slug: "index", title: "Home", sections: [{ key: "s", title: "About", body: "Some copy." }] }],
  });
  assert.ok(!issues.some((i) => i.code === "missing-section-items"));
});

console.log("\nrenderSiteToStaticFiles");
const tokens: DesignTokens = {
  colors: {
    background: "#0d0d0d",
    surface: "#1a1a1a",
    text: "#ffffff",
    textMuted: "#aaaaaa",
    accent: "#ff6b6b",
  },
  fonts: { display: "Space Grotesk", body: "Inter" },
  radius: "12px",
};

test("emits one html file per page plus a stylesheet", () => {
  const files = renderSiteToStaticFiles({ name: "Kyoto Coffee", pages, tokens, badgeEnabled: false });
  assert.deepEqual(
    files.map((f) => f.path).sort(),
    ["about.html", "index.html", "styles.css"]
  );
});
test("first page becomes index.html and nav links to it by filename", () => {
  const files = renderSiteToStaticFiles({ name: "Kyoto Coffee", pages, tokens, badgeEnabled: false });
  const about = files.find((f) => f.path === "about.html")!.contents;
  assert.match(about, /href="index\.html"/);
  // The current page renders as plain text, not a self-link.
  assert.match(about, /aria-current="page"/);
});
test("uses the site's real design tokens in the css", () => {
  const css = renderSiteToStaticFiles({ name: "X", pages, tokens, badgeEnabled: false }).find(
    (f) => f.path === "styles.css"
  )!.contents;
  assert.match(css, /--accent: #ff6b6b;/);
  assert.match(css, /--bg: #0d0d0d;/);
  assert.match(css, /"Space Grotesk"/);
});
test("falls back to safe defaults when tokens are missing", () => {
  const css = renderSiteToStaticFiles({ name: "X", pages, tokens: null, badgeEnabled: false }).find(
    (f) => f.path === "styles.css"
  )!.contents;
  assert.match(css, /--accent: #3b82f6;/);
});
test("rejects malformed token values instead of injecting them into css", () => {
  const evil: DesignTokens = {
    colors: { ...tokens.colors, accent: "red; } body { display: none } .x {" },
    fonts: { display: 'Evil"; } body { display:none } @import "x', body: "Inter" },
    radius: "12px; position: fixed",
  };
  const css = renderSiteToStaticFiles({ name: "X", pages, tokens: evil, badgeEnabled: false }).find(
    (f) => f.path === "styles.css"
  )!.contents;
  assert.doesNotMatch(css, /display\s*:\s*none/);
  assert.doesNotMatch(css, /@import/);
  assert.doesNotMatch(css, /position\s*:\s*fixed/);
  assert.match(css, /--accent: #3b82f6;/); // fell back
});
test("escapes html in site content", () => {
  const xss: GeneratedPage[] = [
    {
      slug: "index",
      title: "Home",
      sections: [{ key: "a", title: "<script>alert(1)</script>", body: "5 > 3 && 2 < 4" }],
    },
  ];
  const html = renderSiteToStaticFiles({
    name: "<img onerror=x>",
    pages: xss,
    tokens,
    badgeEnabled: true,
  }).find((f) => f.path === "index.html")!.contents;
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<img onerror/);
});
test("renders each real layout's own markup, not just the plain block", () => {
  const varied: GeneratedPage[] = [
    {
      slug: "index",
      title: "Home",
      sections: [
        { key: "s1", title: "By the numbers", body: "", layout: "stats", items: [{ label: "500+", detail: "orders" }, { label: "12", detail: "years" }] },
        { key: "s2", title: "What we offer", body: "", layout: "features", items: [{ label: "Fast", detail: "Same-day turnaround" }, { label: "Local", detail: "Sourced within 50 miles" }] },
        { key: "s3", title: "How it works", body: "", layout: "list", items: [{ label: "Order online" }, { label: "We roast" }] },
        { key: "s4", title: "Reviews", body: "Best coffee in town.", layout: "quote", attribution: "A regular" },
        { key: "s5", title: "Ready?", body: "Come say hi.", layout: "cta" },
      ],
    },
  ];
  const html = renderSiteToStaticFiles({ name: "X", pages: varied, tokens, badgeEnabled: false }).find(
    (f) => f.path === "index.html"
  )!.contents;
  assert.match(html, /class="site-section site-section-stats"/);
  assert.match(html, /site-stat-value">500\+</);
  assert.match(html, /class="site-section site-section-features"/);
  assert.match(html, /site-feature-title">Fast</);
  assert.match(html, /class="site-section site-section-list"/);
  assert.match(html, /site-list-label">Order online</);
  assert.match(html, /class="site-section site-section-quote"/);
  assert.match(html, /site-quote-attribution">A regular</);
  assert.match(html, /class="site-section site-section-cta"/);
});
test("a features section with too few items exports as plain text, not a broken grid", () => {
  const thin: GeneratedPage[] = [
    { slug: "index", title: "Home", sections: [{ key: "s", title: "Offer", body: "One thing.", layout: "features", items: [{ label: "Only one" }] }] },
  ];
  const html = renderSiteToStaticFiles({ name: "X", pages: thin, tokens, badgeEnabled: false }).find(
    (f) => f.path === "index.html"
  )!.contents;
  assert.doesNotMatch(html, /site-section-features/);
  assert.match(html, /class="site-section">/);
  assert.match(html, /One thing\./);
});
test("omits nav for a single-page site but still renders it", () => {
  const single = [pages[0]];
  const html = renderSiteToStaticFiles({ name: "X", pages: single, tokens, badgeEnabled: false }).find(
    (f) => f.path === "index.html"
  )!.contents;
  assert.doesNotMatch(html, /<nav>/);
  assert.match(html, /Home intro\./);
});
test("includes the badge only when enabled", () => {
  const on = renderSiteToStaticFiles({ name: "X", pages, tokens, badgeEnabled: true }).find(
    (f) => f.path === "index.html"
  )!.contents;
  const off = renderSiteToStaticFiles({ name: "X", pages, tokens, badgeEnabled: false }).find(
    (f) => f.path === "index.html"
  )!.contents;
  assert.match(on, /Built with Francisity/);
  assert.doesNotMatch(off, /Built with Francisity/);
});
test("handles a site with no pages at all without throwing", () => {
  const files = renderSiteToStaticFiles({ name: "Empty", pages: [], tokens, badgeEnabled: false });
  assert.deepEqual(files.map((f) => f.path).sort(), ["index.html", "styles.css"]);
});

console.log("\nvalidateSubdomain");
test("accepts a normal address", () => {
  const r = validateSubdomain("kyoto-coffee");
  assert.equal(r.ok && r.value, "kyoto-coffee");
});
test("lowercases and trims", () => {
  const r = validateSubdomain("  Kyoto-Coffee  ");
  assert.equal(r.ok && r.value, "kyoto-coffee");
});
test("rejects too short and too long", () => {
  assert.equal(validateSubdomain("ab").ok, false);
  assert.equal(validateSubdomain("a".repeat(64)).ok, false);
  assert.equal(validateSubdomain("a".repeat(63)).ok, true);
});
test("rejects invalid characters", () => {
  for (const bad of ["has space", "under_score", "dot.dot", "emoji🙂", "UPPER!"]) {
    assert.equal(validateSubdomain(bad).ok, false, bad);
  }
});
test("rejects leading/trailing/double hyphens", () => {
  assert.equal(validateSubdomain("-lead").ok, false);
  assert.equal(validateSubdomain("trail-").ok, false);
  // Double hyphens are the punycode prefix form, so they stay out.
  assert.equal(validateSubdomain("a--b").ok, false);
});
test("rejects reserved hostnames that would shadow app routes", () => {
  for (const bad of ["www", "api", "dashboard", "sign-in", "admin", "s", "francisity"]) {
    assert.equal(validateSubdomain(bad).ok, false, bad);
  }
});
test("every rejection carries a message a user can act on", () => {
  const r = validateSubdomain("-nope");
  assert.equal(r.ok, false);
  assert.equal(typeof (r as { error: string }).error, "string");
  assert.ok((r as { error: string }).error.length > 0);
});

console.log("\nnormalizeSubdomain / suggestSubdomain");
test("normalizes a messy site name", () => {
  assert.equal(normalizeSubdomain("Kyoto Coffee Roastery!"), "kyoto-coffee-roastery");
  assert.equal(normalizeSubdomain("  --Hello__World--  "), "hello-world");
});
test("suggestions are always valid addresses", () => {
  for (const name of ["Kyoto Coffee", "A", "!!!", "Joe's Bar & Grill", "x".repeat(200)]) {
    const suggestion = suggestSubdomain(name);
    assert.equal(validateSubdomain(suggestion).ok, true, `${name} -> ${suggestion}`);
  }
});

console.log("\npublishedUrl");
test("falls back to a path on the app's own origin with no wildcard domain", () => {
  delete process.env.NEXT_PUBLIC_PUBLISH_ROOT_DOMAIN;
  assert.equal(publishedUrl("acme", "https://app.example.com"), "https://app.example.com/s/acme");
  // A trailing slash on the origin must not produce a double slash.
  assert.equal(publishedUrl("acme", "https://app.example.com/"), "https://app.example.com/s/acme");
});
test("uses a real subdomain when a wildcard root domain is configured", () => {
  process.env.NEXT_PUBLIC_PUBLISH_ROOT_DOMAIN = "francisity.app";
  assert.equal(publishedUrl("acme", "https://ignored"), "https://acme.francisity.app");
  delete process.env.NEXT_PUBLIC_PUBLISH_ROOT_DOMAIN;
});

console.log("\nsanitizeTokens");
test("passes through valid tokens untouched", () => {
  const safe = sanitizeTokens(tokens);
  assert.equal(safe.colors.accent, "#ff6b6b");
  assert.equal(safe.displayFont, "Space Grotesk");
  assert.equal(safe.radius, "12px");
});
test("falls back on every malformed field independently", () => {
  const safe = sanitizeTokens({
    colors: { ...tokens.colors, accent: "not-a-color" },
    fonts: { display: "!!!", body: "Inter" },
    radius: "12 furlongs",
  });
  assert.equal(safe.colors.accent, "#3b82f6"); // fell back
  assert.equal(safe.colors.text, "#ffffff"); // valid one kept
  assert.equal(safe.displayFont, "Georgia"); // fell back
  assert.equal(safe.bodyFont, "Inter"); // valid one kept
  assert.equal(safe.radius, "8px"); // fell back
});
test("handles null tokens", () => {
  assert.equal(sanitizeTokens(null).colors.background, "#ffffff");
});

console.log("\nvalidatePassword");
test("accepts a reasonable password", () => {
  assert.equal(validatePassword("correct-horse-battery").ok, true);
});
test("rejects anything under 8 characters", () => {
  assert.equal(validatePassword("short1!").ok, false);
  assert.equal(validatePassword("abcd1234").ok, true);
});
test("rejects passwords past bcrypt's 72-byte limit", () => {
  // bcrypt silently truncates at 72 bytes, so a longer password would have
  // its tail ignored — accepting it would be lying to the user.
  assert.equal(validatePassword("a1b2c3d4".repeat(9)).ok, true); // 72 bytes
  assert.equal(validatePassword("a1b2c3d4".repeat(9) + "x").ok, false); // 73
});
test("counts bytes, not characters, for the limit", () => {
  // Each emoji is 4 bytes: 20 of them is 80 bytes but only 20 characters,
  // so a character-based check would wrongly let this through.
  assert.equal(validatePassword("🙂".repeat(20)).ok, false);
});
test("rejects a password of only spaces", () => {
  assert.equal(validatePassword("          ").ok, false);
});
test("rejects too few distinct characters", () => {
  assert.equal(validatePassword("aaaaaaaa").ok, false);
  assert.equal(validatePassword("11111111").ok, false);
});
test("every rejection carries a message", () => {
  const r = validatePassword("aaa");
  assert.equal(r.ok, false);
  assert.ok((r as { error: string }).error.length > 0);
});

console.log("\nsafeNextPath (open-redirect guard)");
test("allows ordinary same-site paths", () => {
  assert.equal(safeNextPath("/dashboard"), "/dashboard");
  assert.equal(safeNextPath("/dashboard/sites/abc"), "/dashboard/sites/abc");
  // Hyphenated routes are real and must survive.
  assert.equal(safeNextPath("/sign-in"), "/sign-in");
  assert.equal(safeNextPath("/dashboard/new-build"), "/dashboard/new-build");
  assert.equal(safeNextPath("/auth/reset"), "/auth/reset");
  assert.equal(safeNextPath("/dashboard?tab=1#x"), "/dashboard?tab=1#x");
});
test("blocks absolute URLs to another origin", () => {
  assert.equal(safeNextPath("https://evil.example.com"), "/dashboard");
  assert.equal(safeNextPath("http://evil.example.com/phish"), "/dashboard");
});
test("blocks protocol-relative URLs", () => {
  // These start with "/" but browsers treat them as another origin.
  assert.equal(safeNextPath("//evil.example.com"), "/dashboard");
  assert.equal(safeNextPath("///evil.example.com"), "/dashboard");
});
test("blocks backslash and control-character smuggling", () => {
  assert.equal(safeNextPath("/\\evil.example.com"), "/dashboard");
  assert.equal(safeNextPath("/\tevil"), "/dashboard");
  assert.equal(safeNextPath("/\nhttps://evil.example.com"), "/dashboard");
});
test("blocks scheme-like paths", () => {
  assert.equal(safeNextPath("/javascript:alert(1)"), "/dashboard");
  assert.equal(safeNextPath("/data:text/html,x"), "/dashboard");
});
test("falls back for empty or missing values", () => {
  assert.equal(safeNextPath(null), "/dashboard");
  assert.equal(safeNextPath(undefined), "/dashboard");
  assert.equal(safeNextPath(""), "/dashboard");
});

console.log("\npublished-site motion");
test("the scroll reveal is gated behind @supports", () => {
  // This is the safety property for the whole scroll-reveal feature. The
  // reveal starts sections at opacity 0, so if that rule ever applied in a
  // browser without scroll-driven animations, every section would be
  // invisible forever. Gating it means unsupported browsers just show the
  // content. Asserted structurally so a future edit can't quietly undo it.
  const css = buildSiteCss(sanitizeTokens(tokens));
  const supportsIndex = css.indexOf("@supports (animation-timeline: view())");
  assert.ok(supportsIndex > 0, "expected an @supports guard");

  const sectionAnim = css.indexOf(".site-section {\n      animation:");
  assert.ok(sectionAnim > supportsIndex, ".site-section reveal must be inside @supports");
});
test("the scroll reveal also requires no-preference for motion", () => {
  const css = buildSiteCss(sanitizeTokens(tokens));
  const guard = css.indexOf("@supports (animation-timeline: view())");
  const rm = css.indexOf("prefers-reduced-motion: no-preference", guard);
  const sectionAnim = css.indexOf(".site-section {\n      animation:", guard);
  assert.ok(rm > guard && rm < sectionAnim, "reduced-motion guard must wrap the reveal");
});
test("only compositor-friendly properties are animated", () => {
  const css = buildSiteCss(sanitizeTokens(tokens));
  const keyframes = css.slice(css.indexOf("@keyframes site-rise"));
  const block = keyframes.slice(0, keyframes.indexOf("}\n}") + 3);
  // Animating width/height/top/left would force layout on every frame.
  for (const bad of ["width", "height", "top:", "left:", "margin", "padding"]) {
    assert.ok(!block.includes(bad), `site-rise should not animate ${bad}`);
  }
});
test("published sites stay script-free", () => {
  // Dependency-free output is a documented promise, so the motion above has
  // to be pure CSS — no observer, no scroll listener, no bundle.
  const files = renderSiteToStaticFiles({ name: "X", pages, tokens, badgeEnabled: true });
  for (const f of files.filter((f) => f.path.endsWith(".html"))) {
    assert.ok(!f.contents.includes("<script"), `${f.path} should contain no script tag`);
  }
});

console.log("\npromote platforms");
test("every platform has coherent limits", () => {
  for (const p of PLATFORM_LIST) {
    assert.ok(p.targetSeconds > 0, p.id);
    // A script written to targetSeconds must actually be postable.
    assert.ok(p.targetSeconds <= p.maxSeconds, `${p.id}: target exceeds platform max`);
    assert.ok(p.captionLimit > 0, p.id);
    assert.ok(p.uploadSteps.length > 0, `${p.id}: no upload steps`);
    assert.match(p.docsUrl, /^https:\/\//, `${p.id}: docs link`);
  }
});
test("isPlatformId only accepts real platforms", () => {
  assert.equal(isPlatformId("tiktok"), true);
  assert.equal(isPlatformId("myspace"), false);
  // Must not be fooled by inherited Object properties.
  assert.equal(isPlatformId("toString"), false);
  assert.equal(isPlatformId("constructor"), false);
});

console.log("\nbeltCommand");
test("builds a runnable command with valid JSON", () => {
  const cmd = beltCommand("google/veo-3-1-fast", "a cat on a wall", 15, true);
  assert.match(cmd, /^belt app run google\/veo-3-1-fast --input '/);
  const json = cmd.slice(cmd.indexOf("'") + 1, cmd.lastIndexOf("'"));
  const parsed = JSON.parse(json);
  assert.equal(parsed.prompt, "a cat on a wall");
  assert.equal(parsed.duration, 15);
  assert.equal(parsed.generate_audio, true);
});
test("omits generate_audio for silent models", () => {
  const cmd = beltCommand("xai/grok-imagine-video", "waves", 5, false);
  assert.doesNotMatch(cmd, /generate_audio/);
});
test("escapes single quotes so the shell command can't break out", () => {
  // A prompt containing a quote would otherwise close the shell's quoting
  // and turn the rest of the prompt into separate arguments (or commands).
  const cmd = beltCommand("google/veo-3-1-fast", "a dog's day; rm -rf /", 10, false);
  assert.doesNotMatch(cmd, /[^\\]'; rm/);
  assert.ok(cmd.includes(`'\\''`), "single quote should be shell-escaped");
});

console.log("\nsanitizeOptions");
test("passes through a short list of trimmed strings", () => {
  assert.deepEqual(sanitizeOptions(["Write vivid descriptions", " Restyle it visually "]), [
    "Write vivid descriptions",
    "Restyle it visually",
  ]);
});
test("returns empty for non-array input", () => {
  assert.deepEqual(sanitizeOptions(null), []);
  assert.deepEqual(sanitizeOptions("Write vivid descriptions"), []);
  assert.deepEqual(sanitizeOptions(undefined), []);
});
test("drops non-string entries and blank strings", () => {
  assert.deepEqual(sanitizeOptions(["Real option", 42, null, "  ", {}]), ["Real option"]);
});
test("drops duplicate entries", () => {
  assert.deepEqual(sanitizeOptions(["Yes", "No", "Yes"]), ["Yes", "No"]);
});
test("caps the list at 4 options", () => {
  assert.deepEqual(sanitizeOptions(["A", "B", "C", "D", "E", "F"]), ["A", "B", "C", "D"]);
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures above)" : ""}\n`);
