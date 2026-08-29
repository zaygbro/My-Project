// Proves the validation logic itself actually catches what it claims to —
// separate from the real-brief test, since all 8 real briefs passed
// cleanly and never exercised these paths. No API calls, no cost.
import { validateProject } from "../src/lib/generation/validate";
import type { GenerationOutput, StructuredBrief } from "../src/lib/generation/types";

const brief: StructuredBrief = {
  industry: "Test industry",
  tone: "test",
  mustHavePages: ["Home", "About", "Contact"],
};

const goodTokens = {
  background: "#0A0A0C",
  surface: "#111114",
  text: "#FFFFFF",
  textMuted: "#9A9AA6",
  accent: "#3B82F6",
};

const cases: { name: string; output: GenerationOutput; expectCode: string }[] = [
  {
    name: "missing required page",
    output: {
      tokens: { colors: goodTokens, fonts: { display: "Inter", body: "Inter" }, radius: "8px" },
      pages: [
        { slug: "home", title: "Home", sections: [{ key: "hero", title: "Hero", body: "Real specific copy." }] },
        { slug: "about", title: "About", sections: [{ key: "body", title: "About", body: "Real specific copy." }] },
        // "Contact" page missing entirely
      ],
    },
    expectCode: "missing-required-page",
  },
  {
    name: "duplicate slug",
    output: {
      tokens: { colors: goodTokens, fonts: { display: "Inter", body: "Inter" }, radius: "8px" },
      pages: [
        { slug: "home", title: "Home", sections: [{ key: "hero", title: "Hero", body: "Real specific copy." }] },
        { slug: "home", title: "Home again", sections: [{ key: "hero2", title: "Hero", body: "Real specific copy." }] },
        { slug: "about", title: "About", sections: [{ key: "body", title: "About", body: "Real specific copy." }] },
        { slug: "contact", title: "Contact", sections: [{ key: "body", title: "Contact", body: "Real copy." }] },
      ],
    },
    expectCode: "duplicate-slug",
  },
  {
    name: "generic filler text",
    output: {
      tokens: { colors: goodTokens, fonts: { display: "Inter", body: "Inter" }, radius: "8px" },
      pages: [
        { slug: "home", title: "Home", sections: [{ key: "hero", title: "Hero", body: "Lorem ipsum dolor sit amet." }] },
        { slug: "about", title: "About", sections: [{ key: "body", title: "About", body: "Real specific copy." }] },
        { slug: "contact", title: "Contact", sections: [{ key: "body", title: "Contact", body: "Real copy." }] },
      ],
    },
    expectCode: "generic-filler",
  },
  {
    name: "broken internal link",
    output: {
      tokens: { colors: goodTokens, fonts: { display: "Inter", body: "Inter" }, radius: "8px" },
      pages: [
        {
          slug: "home",
          title: "Home",
          sections: [{ key: "hero", title: "Hero", body: "See our [pricing](/pricing) page for details." }],
        },
        { slug: "about", title: "About", sections: [{ key: "body", title: "About", body: "Real specific copy." }] },
        { slug: "contact", title: "Contact", sections: [{ key: "body", title: "Contact", body: "Real copy." }] },
      ],
    },
    expectCode: "broken-internal-link",
  },
  {
    name: "low contrast text",
    output: {
      tokens: {
        colors: { background: "#1a1a1a", surface: "#222222", text: "#2a2a2a", textMuted: "#9A9AA6", accent: "#3B82F6" },
        fonts: { display: "Inter", body: "Inter" },
        radius: "8px",
      },
      pages: [
        { slug: "home", title: "Home", sections: [{ key: "hero", title: "Hero", body: "Real specific copy." }] },
        { slug: "about", title: "About", sections: [{ key: "body", title: "About", body: "Real specific copy." }] },
        { slug: "contact", title: "Contact", sections: [{ key: "body", title: "Contact", body: "Real copy." }] },
      ],
    },
    expectCode: "low-contrast-text",
  },
  {
    name: "invalid hex color",
    output: {
      tokens: { colors: { ...goodTokens, accent: "blue" }, fonts: { display: "Inter", body: "Inter" }, radius: "8px" },
      pages: [
        { slug: "home", title: "Home", sections: [{ key: "hero", title: "Hero", body: "Real specific copy." }] },
        { slug: "about", title: "About", sections: [{ key: "body", title: "About", body: "Real specific copy." }] },
        { slug: "contact", title: "Contact", sections: [{ key: "body", title: "Contact", body: "Real copy." }] },
      ],
    },
    expectCode: "invalid-color",
  },
];

let failures = 0;
for (const c of cases) {
  const issues = validateProject(brief, c.output);
  const caught = issues.some((i) => i.code === c.expectCode);
  console.log(`${caught ? "PASS" : "FAIL"} — ${c.name}: expected "${c.expectCode}", found [${issues.map((i) => i.code).join(", ")}]`);
  if (!caught) failures++;
}

// A genuinely valid project should produce zero issues — proves the
// validator isn't just permanently paranoid.
const cleanIssues = validateProject(brief, {
  tokens: { colors: goodTokens, fonts: { display: "Inter", body: "Inter" }, radius: "8px" },
  pages: [
    { slug: "home", title: "Home", sections: [{ key: "hero", title: "Hero", body: "Real specific copy about the business." }] },
    { slug: "about", title: "About", sections: [{ key: "body", title: "About", body: "Real specific copy about the business." }] },
    { slug: "contact", title: "Contact", sections: [{ key: "body", title: "Contact", body: "Real specific contact copy." }] },
  ],
});
console.log(`${cleanIssues.length === 0 ? "PASS" : "FAIL"} — clean project: expected 0 issues, found ${cleanIssues.length}`);
if (cleanIssues.length !== 0) failures++;

console.log(`\n${cases.length + 1 - failures}/${cases.length + 1} checks passed.`);
process.exit(failures > 0 ? 1 : 0);
