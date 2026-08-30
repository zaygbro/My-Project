import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { buildSiteCss, googleFontsHref, sanitizeTokens } from "@/lib/site-theme";
import type { DesignTokens, GeneratedPage } from "@/lib/generation/types";

/**
 * The owner's own full-fidelity look at a site — same rendering (real
 * header/nav/sections, the site's own generated CSS) as the public
 * `/s/[subdomain]` route, but reading the LIVE `pages`/`design_tokens`
 * instead of a published snapshot, and gated by ownership instead of by
 * "is this published". This is what "Open in new tab" on the dashboard's
 * split-pane preview links to — a real page instead of the compact,
 * capped-height mock rendered inline there.
 */
interface OwnedSite {
  id: string;
  name: string;
  pages: GeneratedPage[];
  tokens: DesignTokens | null;
}

async function loadOwnedSite(id: string): Promise<OwnedSite | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("sites")
    .select("id, name, pages, design_tokens, generation_status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!data || data.generation_status !== "validated") return null;

  return {
    id: data.id,
    name: data.name,
    pages: (data.pages ?? []) as GeneratedPage[],
    tokens: data.design_tokens as DesignTokens | null,
  };
}

function resolvePage(pages: GeneratedPage[], slug: string[] | undefined): GeneratedPage | undefined {
  if (!slug || slug.length === 0) return pages[0];
  if (slug.length > 1) return undefined;
  return pages.find((p) => p.slug === slug[0]);
}

export async function generateMetadata(
  props: PageProps<"/preview/[id]/[[...slug]]">
): Promise<Metadata> {
  const { id, slug } = await props.params;
  const site = await loadOwnedSite(id);
  if (!site) return { title: "Not found" };

  const page = resolvePage(site.pages, slug);
  const isHome = !page || page.slug === site.pages[0]?.slug;
  return { title: `Preview — ${isHome ? site.name : `${page.title} — ${site.name}`}` };
}

export default async function DraftPreviewPage(props: PageProps<"/preview/[id]/[[...slug]]">) {
  const { id, slug } = await props.params;
  const site = await loadOwnedSite(id);
  if (!site || site.pages.length === 0) notFound();

  const page = resolvePage(site.pages, slug);
  if (!page) notFound();

  const tokens = sanitizeTokens(site.tokens);
  const css = buildSiteCss(tokens);
  const home = site.pages[0].slug;
  const hrefFor = (s: string) => (s === home ? `/preview/${id}` : `/preview/${id}/${s}`);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={googleFontsHref(tokens)} />
      <style>{css}</style>

      <a
        href={`/dashboard/sites/${id}`}
        className="fixed left-3 top-3 z-50 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 font-mono text-xs text-white no-underline backdrop-blur-sm transition-colors hover:bg-black/90"
      >
        ← Dashboard
      </a>

      <header className="site-header">
        <a className="site-brand" href={hrefFor(home)}>
          {site.name}
        </a>
        {site.pages.length > 1 && (
          <nav className="site-nav">
            {site.pages.map((p) =>
              p.slug === page.slug ? (
                <span key={p.slug} aria-current="page">
                  {p.title}
                </span>
              ) : (
                <a key={p.slug} href={hrefFor(p.slug)}>
                  {p.title}
                </a>
              )
            )}
          </nav>
        )}
      </header>

      <main className="site-main">
        <h1>{page.title}</h1>
        {page.sections.map((section) => (
          <section key={section.key} id={section.key} className="site-section">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </main>
    </>
  );
}
