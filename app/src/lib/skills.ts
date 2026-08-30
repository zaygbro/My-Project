// The Claude Code skills actually downloaded for this project (mirrors
// skills-lock.json's key list) — the single source of truth for both the
// marketing site's public Skills section and the signed-in app's Skills
// tab, so the two never drift apart.
export interface SkillEntry {
  name: string;
  source: string;
  desc: string;
}

export const SKILLS: SkillEntry[] = [
  { name: "ai-video-generation", source: "inference-sh/skills", desc: "Generate AI video with Veo, Seedance, Wan, and 40+ models — text-to-video, image-to-video, lipsync, upscaling." },
  { name: "animate", source: "emilkowalski/skill", desc: "Build an animation from scratch — should it animate, what purpose, which tool, which curve and duration, how it interrupts, how it exits." },
  { name: "animate-expo", source: "emilkowalski/skill", desc: "Build animations in React Native and Expo with Reanimated, Gesture Handler, Expo Router and expo-haptics." },
  { name: "animation-vocabulary", source: "emilkowalski/skills", desc: "Reverse-lookup glossary that turns a vague description of a motion effect into its exact term." },
  { name: "api-design-principles", source: "wshobson/agents", desc: "REST and GraphQL API design principles for building intuitive, scalable, maintainable APIs." },
  { name: "apple-design", source: "emilkowalski/skills", desc: "Apple's approach to interface design and fluid, physical motion, translated for the web — gestures, springs, materials, typography, reduced motion." },
  { name: "ask-sonner", source: "emilkowalski/skill", desc: "Install and wire up Sonner toasts — promise/loading toasts, theming, positioning, troubleshooting." },
  { name: "banner-design", source: "nextlevelbuilder/ui-ux-pro-max-skill", desc: "Design banners for social media, ads, website heroes, and print, with multiple art-direction options." },
  { name: "brand", source: "nextlevelbuilder/ui-ux-pro-max-skill", desc: "Brand voice, visual identity, messaging frameworks, asset management, brand consistency." },
  { name: "brandkit", source: "Leonxlnx/taste-skill", desc: "Premium brand-kit image generation — logo systems, identity decks, visual-world presentations." },
  { name: "canvas-design", source: "anthropics/skills", desc: "Create original visual art in .png and .pdf using design philosophy, never copying existing artists." },
  { name: "design", source: "nextlevelbuilder/ui-ux-pro-max-skill", desc: "Comprehensive design skill: brand identity, tokens, UI styling, logo generation, presentations, banners, icons, social photos." },
  { name: "design-system", source: "nextlevelbuilder/ui-ux-pro-max-skill", desc: "Token architecture, component specifications, and strategic slide creation." },
  { name: "design-taste-frontend", source: "leonxlnx/taste-skill", desc: "Anti-slop frontend skill for landing pages, portfolios, and redesigns that reads the brief and ships interfaces that do not look templated." },
  { name: "design-taste-frontend-v1", source: "leonxlnx/taste-skill", desc: "The original taste-skill, preserved for projects depending on its exact behavior." },
  { name: "emil-design-eng", source: "emilkowalski/skill", desc: "Emil Kowalski's philosophy on UI polish, component design, animation decisions, and the invisible details that make software feel great." },
  { name: "figma", source: "heygen-com/hyperframes", desc: "Import Figma content into a motion composition — assets, tokens, components reconstructed as real motion." },
  { name: "find-animation-opportunities", source: "emilkowalski/skill", desc: "Search a codebase or UI for places that should animate but don't, and reject everywhere that shouldn't." },
  { name: "fixing-motion-performance", source: "ibelick/ui-skills", desc: "Audit and fix animation performance — layout thrashing, compositor properties, scroll-linked motion, blur." },
  { name: "frontend-design", source: "anthropics/skills", desc: "Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults." },
  { name: "full-output-enforcement", source: "Leonxlnx/taste-skill", desc: "Overrides default LLM truncation behavior — enforces complete code generation and bans placeholder patterns." },
  { name: "gpt-taste", source: "Leonxlnx/taste-skill", desc: "Elite UX/UI and GSAP motion engineer enforcing editorial typography, gapless bento grids, and strict scroll choreography." },
  { name: "high-end-visual-design", source: "leonxlnx/taste-skill", desc: "The exact fonts, spacing, shadows, card structures, and animations that make a website feel expensive." },
  { name: "hyperframes-animation", source: "heygen-com/hyperframes", desc: "Motion rules, scene blueprints, transitions, and runtime adapters (GSAP, Lottie, Three.js, and more)." },
  { name: "image-to-code", source: "Leonxlnx/taste-skill", desc: "Generate a design image first, analyze it deeply, then implement the site to match it as closely as possible." },
  { name: "imagegen-frontend-mobile", source: "Leonxlnx/taste-skill", desc: "Premium, app-native mobile screen concepts and flows for iOS, Android, and cross-platform products." },
  { name: "imagegen-frontend-web", source: "Leonxlnx/taste-skill", desc: "Premium, conversion-aware website design references — one image per section, composition variety enforced." },
  { name: "improve-animations", source: "emilkowalski/skill", desc: "Survey a codebase's motion as a senior advisor and produce a prioritized audit with implementation plans." },
  { name: "industrial-brutalist-ui", source: "Leonxlnx/taste-skill", desc: "Raw mechanical interfaces fusing Swiss typographic print with military terminal aesthetics." },
  { name: "landing-page-design", source: "inference-sh/skills", desc: "Landing page conversion optimization — hero formula, social proof placement, CTA psychology, mobile design." },
  { name: "minimalist-ui", source: "Leonxlnx/taste-skill", desc: "Clean editorial-style interfaces — warm monochrome palette, typographic contrast, flat bento grids." },
  { name: "mobile-ios-design", source: "wshobson/agents", desc: "Apple's Human Interface Guidelines and SwiftUI patterns for native iOS apps." },
  { name: "motion-graphics", source: "heygen-com/hyperframes", desc: "Short, design-led motion graphics — kinetic typography, stat count-ups, logo stings, animated data." },
  { name: "pick-ui-library", source: "emilkowalski/skill", desc: "Choose the right UI component library for a project instead of defaulting to the same one every time." },
  { name: "prototype", source: "emilkowalski/skill", desc: "Build a fast, throwaway prototype to test an idea before investing in the real implementation." },
  { name: "redesign-existing-projects", source: "Leonxlnx/taste-skill", desc: "Upgrade an existing site or app to premium quality by auditing it and removing generic AI patterns." },
  { name: "review-animations", source: "emilkowalski/skill", desc: "Critique the motion already in a component or page, rather than building new animation from scratch." },
  { name: "sleek-design-mobile-apps", source: "sleekdotdesign/agent-skills", desc: "Design and implement Sleek-style mobile app screens in HTML, React Native, or SwiftUI." },
  { name: "slides", source: "nextlevelbuilder/ui-ux-pro-max-skill", desc: "Strategic HTML presentations with Chart.js, design tokens, and copywriting formulas." },
  { name: "stitch-design-taste", source: "Leonxlnx/taste-skill", desc: "Semantic design-system rules for Google Stitch — strict typography, calibrated color, perpetual micro-motion." },
  { name: "ui-styling", source: "nextlevelbuilder/ui-ux-pro-max-skill", desc: "Beautiful, accessible UIs with shadcn/ui, Tailwind, and canvas-based visual design." },
  { name: "ui-ux-pro-max", source: "nextlevelbuilder/ui-ux-pro-max-skill", desc: "UI/UX design intelligence for web, mobile, and desktop — styles, palettes, font pairings, guidelines, icons." },
  { name: "write-swift", source: "emilkowalski/skill", desc: "How to write modern Swift well — value types, Swift 6 concurrency, protocols and generics, performance." },
];
