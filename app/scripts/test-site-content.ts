// Unit tests for the pure pieces of the multi-page generation wire-up.
// These need no database and no API key, so they actually run in CI (and in
// a sandbox) — unlike anything that touches Supabase or Anthropic.
//
//   npx tsx scripts/test-site-content.ts

import assert from "node:assert/strict";
import {
  countSections,
  deriveMustHavePages,
  findSection,
  replaceSectionBody,
  sectionRef,
} from "../src/lib/site-content";
import { renderSiteToStaticFiles } from "../src/lib/export";
import {
  normalizeSubdomain,
  publishedUrl,
  suggestSubdomain,
  validateSubdomain,
} from "../src/lib/publish";
import { sanitizeTokens } from "../src/lib/site-theme";
import { validatePassword } from "../src/lib/password";
import { safeNextPath } from "../src/lib/redirects";
import type { DesignTokens, GeneratedPage } from "../src/lib/generation/types";

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

console.log("\ncountSections");
test("counts across every page", () => {
  assert.equal(countSections(pages), 3);
  assert.equal(countSections([]), 0);
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

console.log(`\n${passed} passed${process.exitCode ? " (with failures above)" : ""}\n`);
