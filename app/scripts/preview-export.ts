// Renders a sample site with renderSiteToStaticFiles so the published-site
// look (and its motion) can be eyeballed without a database or an API key.
//   npx tsx scripts/preview-export.ts <outDir>
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { renderSiteToStaticFiles } from "../src/lib/export";

const out = process.argv[2] ?? ".preview";
mkdirSync(out, { recursive: true });

const files = renderSiteToStaticFiles({
  name: "Kissaten",
  badgeEnabled: true,
  tokens: {
    colors: {
      background: "#faf7f2",
      surface: "#e8e0d4",
      text: "#221d18",
      textMuted: "#6b6156",
      accent: "#b4552d",
    },
    fonts: { display: "Playfair Display", body: "Inter" },
    radius: "10px",
  },
  pages: [
    {
      slug: "index",
      title: "Home",
      sections: [
        { key: "intro", title: "A quiet room for coffee", body: "Kissaten is a twelve-seat coffee bar in Kyoto's Nakagyo ward. We roast single-origin beans in small batches every Tuesday and serve them by hand-drip, one cup at a time." },
        { key: "hours", title: "Hours", body: "Open Wednesday to Sunday, 8am until 4pm. Closed Monday and Tuesday while we roast." },
        { key: "space", title: "The room", body: "Twelve seats along a single cypress counter. No music after noon, no laptops on weekends." },
      ],
    },
    { slug: "about", title: "About", sections: [{ key: "story", title: "Our story", body: "We opened in 2019 in a converted machiya." }] },
    { slug: "contact", title: "Contact", sections: [{ key: "visit", title: "Visit", body: "Two minutes from Karasuma Oike station, exit 3." }] },
  ],
});

for (const f of files) writeFileSync(join(out, f.path), f.contents);
console.log(`wrote ${files.length} files to ${out}: ${files.map((f) => f.path).join(", ")}`);
