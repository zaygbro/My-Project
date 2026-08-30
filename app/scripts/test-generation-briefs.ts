// Checkpoint 1 test harness: runs the generation+validation pipeline
// against 8 varied real briefs and reports what happened on each —
// first-try pass, fix-pass recovery, or escalation. Run with:
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/test-generation-briefs.ts
import { generateProject } from "../src/lib/generation/generate";
import type { StructuredBrief } from "../src/lib/generation/types";

const briefs: StructuredBrief[] = [
  {
    industry: "Architecture studio",
    tone: "minimalist, editorial",
    mustHavePages: ["Home", "Projects", "Contact"],
    brandAssets: { primaryColor: "#1a1a1a" },
  },
  {
    industry: "Dog-friendly cafe",
    tone: "warm, playful",
    mustHavePages: ["Home", "Menu", "Contact"],
    references: ["Kinfolk magazine aesthetic"],
  },
  {
    industry: "Corporate law firm",
    tone: "authoritative, trustworthy",
    mustHavePages: ["Home", "Practice Areas", "Attorneys", "Contact"],
  },
  {
    industry: "Boutique fitness studio",
    tone: "energetic, bold",
    mustHavePages: ["Home", "Classes", "Pricing", "Contact"],
  },
  {
    industry: "SaaS analytics dashboard product",
    tone: "technical, confident",
    mustHavePages: ["Home", "Pricing", "Docs"],
    brandAssets: { logoDescription: "a simple geometric mark, no gradients" },
  },
  {
    industry: "Independent record label",
    tone: "moody, alternative",
    mustHavePages: ["Home", "Artists", "Releases"],
  },
  {
    industry: "Pediatric dental practice",
    tone: "friendly, reassuring",
    mustHavePages: ["Home", "Services", "New Patients", "Contact"],
  },
  {
    industry: "Wedding photographer portfolio",
    tone: "romantic, elegant",
    mustHavePages: ["Home", "Portfolio", "Pricing", "Contact"],
    freeformNotes: "Should feel timeless, not trendy.",
  },
];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const results: {
    industry: string;
    status: string;
    passedOnFirstTry: boolean;
    issueCountFirstPass: number;
    costUsd: number;
  }[] = [];

  for (const brief of briefs) {
    process.stdout.write(`\n=== ${brief.industry} ===\n`);
    const state = await generateProject(brief, "claude-haiku-4-5");

    const firstValidate = state.changeLog.find((e) => e.kind === "validate");
    const issueCountFirstPass = firstValidate?.issues?.length ?? 0;
    const passedOnFirstTry = issueCountFirstPass === 0;

    console.log(`Status: ${state.status}`);
    console.log(`Pages generated: ${state.pages.map((p) => p.slug).join(", ")}`);
    console.log(`First-pass issues: ${issueCountFirstPass}`);
    for (const entry of state.changeLog) {
      console.log(`  [${entry.kind}] ${entry.summary}${entry.usage ? ` ($${entry.usage.costUsd.toFixed(4)})` : ""}`);
      if (entry.issues?.length) {
        for (const issue of entry.issues) console.log(`      - ${issue.code}: ${issue.message}`);
      }
    }
    console.log(`Total cost: $${state.totalCostUsd.toFixed(4)}`);

    results.push({
      // Every brief in this script's fixture list sets an industry; the
      // fallback exists because the field is optional for freeform
      // dashboard briefs, which this script doesn't exercise.
      industry: brief.industry ?? "(freeform)",
      status: state.status,
      passedOnFirstTry,
      issueCountFirstPass,
      costUsd: state.totalCostUsd,
    });
  }

  console.log("\n\n=== SUMMARY ===");
  const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
  const firstTryPasses = results.filter((r) => r.passedOnFirstTry).length;
  const recovered = results.filter((r) => !r.passedOnFirstTry && r.status === "validated").length;
  const escalated = results.filter((r) => r.status === "failed").length;
  console.table(results);
  console.log(`Passed first try: ${firstTryPasses}/${results.length}`);
  console.log(`Recovered via fix pass: ${recovered}/${results.length}`);
  console.log(`Escalated (failed twice): ${escalated}/${results.length}`);
  console.log(`Total cost across all ${results.length} briefs: $${totalCost.toFixed(4)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
