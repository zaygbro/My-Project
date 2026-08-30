import { sanitizeSection } from "@/lib/site-content";
import type { PageSection } from "@/lib/generation/types";

/**
 * One section of a generated/published site, drawn according to its layout
 * instead of always as the same heading+paragraph block — see
 * PageSection.layout's doc comment for why that sameness was the actual bug.
 * Shared by the published site and the owner's draft preview, which used to
 * each hand-roll the identical `<h2>/<p>` markup; export.ts renders the same
 * layouts as static HTML strings since it can't use React components.
 */
export function SiteSection({ section }: { section: PageSection }) {
  const safe = sanitizeSection(section);

  switch (safe.layout) {
    case "stats":
      return (
        <section id={safe.key} className="site-section site-section-stats">
          <h2>{safe.title}</h2>
          {safe.body && <p>{safe.body}</p>}
          <div className="site-items">
            {safe.items.map((item, i) => (
              <div key={i} className="site-stat">
                <span className="site-stat-value">{item.label}</span>
                {item.detail && <span className="site-stat-detail">{item.detail}</span>}
              </div>
            ))}
          </div>
        </section>
      );

    case "features":
      return (
        <section id={safe.key} className="site-section site-section-features">
          <h2>{safe.title}</h2>
          {safe.body && <p>{safe.body}</p>}
          <div className="site-items">
            {safe.items.map((item, i) => (
              <div key={i} className="site-feature">
                <span className="site-feature-title">{item.label}</span>
                {item.detail && <span className="site-feature-detail">{item.detail}</span>}
              </div>
            ))}
          </div>
        </section>
      );

    case "list":
      return (
        <section id={safe.key} className="site-section site-section-list">
          <h2>{safe.title}</h2>
          {safe.body && <p>{safe.body}</p>}
          <ul className="site-list">
            {safe.items.map((item, i) => (
              <li key={i}>
                <span className="site-list-label">{item.label}</span>
                {item.detail && <span className="site-list-detail">{item.detail}</span>}
              </li>
            ))}
          </ul>
        </section>
      );

    case "quote":
      return (
        <section id={safe.key} className="site-section site-section-quote">
          <h2>{safe.title}</h2>
          <blockquote className="site-quote">
            <p>{safe.body}</p>
            {safe.attribution && <cite className="site-quote-attribution">{safe.attribution}</cite>}
          </blockquote>
        </section>
      );

    case "cta":
      return (
        <section id={safe.key} className="site-section site-section-cta">
          <h2>{safe.title}</h2>
          <p>{safe.body}</p>
        </section>
      );

    default:
      return (
        <section id={safe.key} className="site-section">
          <h2>{safe.title}</h2>
          <p>{safe.body}</p>
        </section>
      );
  }
}
