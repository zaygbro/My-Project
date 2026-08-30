import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSiteCss, googleFontsHref, sanitizeTokens } from "@/lib/site-theme";
import type { DesignTokens, GeneratedPage } from "@/lib/generation/types";
import { SiteSection } from "@/components/site/SiteSection";
import { ViewBeacon } from "./ViewBeacon";

// A published site is public and changes only when its owner re-publishes,
// so it's cached and revalidated rather than rendered per visit.
export const revalidate = 60;

interface PublishedSite {
  id: string;
  name: string;
  pages: GeneratedPage[];
  tokens: DesignTokens | null;
  badgeEnabled: boolean;
}

/**
 * Visitors are anonymous, and RLS scopes `sites` to its owner, so this reads
 * through the service-role client. That's deliberate rather than adding an
 * anon read policy: RLS is row-level, not column-level, so "anyone may read
 * published rows" would also expose that row's DRAFT `pages`, its `brief`,
 * and its owner's user_id. Selecting an explicit allowlist of published_*
 * columns is the narrower, safer boundary.
 */
async function loadPublishedSite(subdomain: string): Promise<PublishedSite | null> {
  const normalized = subdomain.toLowerCase();
  if (!/^[a-z0-9-]{1,63}$/.test(normalized)) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("sites")
    .select("id, published_name, published_pages, published_design_tokens, badge_enabled, published_at")
    .eq("subdomain", normalized)
    .not("published_at", "is", null)
    .maybeSingle();

  if (!data || !data.published_pages || data.published_pages.length === 0) return null;

  return {
    id: data.id,
    name: data.published_name ?? normalized,
    pages: data.published_pages,
    tokens: data.published_design_tokens,
    badgeEnabled: data.badge_enabled,
  };
}

function resolvePage(site: PublishedSite, slug: string[] | undefined): GeneratedPage | undefined {
  // No slug = the site's entry point, which is its first page.
  if (!slug || slug.length === 0) return site.pages[0];
  if (slug.length > 1) return undefined;
  return site.pages.find((p) => p.slug === slug[0]);
}

export async function generateMetadata(
  props: PageProps<"/s/[subdomain]/[[...slug]]">
): Promise<Metadata> {
  const { subdomain, slug } = await props.params;
  const site = await loadPublishedSite(subdomain);
  if (!site) return { title: "Not found" };

  const page = resolvePage(site, slug);
  if (!page) return { title: site.name };

  // The first section's copy is the closest thing to a real description,
  // and it's genuine content rather than an invented marketing line.
  const description = page.sections[0]?.body.slice(0, 160);
  const isHome = page.slug === site.pages[0].slug;

  return {
    title: isHome ? site.name : `${page.title} — ${site.name}`,
    description,
    openGraph: {
      title: isHome ? site.name : `${page.title} — ${site.name}`,
      description,
      type: "website",
    },
  };
}

export default async function PublishedSitePage(props: PageProps<"/s/[subdomain]/[[...slug]]">) {
  const { subdomain, slug } = await props.params;
  const site = await loadPublishedSite(subdomain);
  if (!site) notFound();

  const page = resolvePage(site, slug);
  if (!page) notFound();

  const tokens = sanitizeTokens(site.tokens);
  const css = buildSiteCss(tokens);
  const home = site.pages[0].slug;
  const hrefFor = (s: string) => (s === home ? `/s/${subdomain}` : `/s/${subdomain}/${s}`);

  return (
    <>
      {/* The site is rendered with its OWN generated tokens, not the
          dashboard's theme — the whole point is that every generated site
          looks different. Sanitized in site-theme.ts before it gets here. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={googleFontsHref(tokens)} />
      <style>{css}</style>

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
          <SiteSection key={section.key} section={section} />
        ))}
      </main>

      {site.badgeEnabled && (
        <footer className="site-footer">
          <a href="https://francisity.com" rel="noopener">
            Built with Francisity
          </a>
        </footer>
      )}

      <ViewBeacon siteId={site.id} path={`/${slug?.join("/") ?? ""}`} />
    </>
  );
}
