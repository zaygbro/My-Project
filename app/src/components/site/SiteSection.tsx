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

    case "faq":
      return (
        <section id={safe.key} className="site-section site-section-faq">
          <h2>{safe.title}</h2>
          {safe.body && <p>{safe.body}</p>}
          <div className="site-faq">
            {safe.items.map((item, i) => (
              <details key={i} className="site-faq-item">
                <summary className="site-faq-question">{item.label}</summary>
                {item.detail && <p className="site-faq-answer">{item.detail}</p>}
              </details>
            ))}
          </div>
        </section>
      );

    case "team":
      return (
        <section id={safe.key} className="site-section site-section-team">
          <h2>{safe.title}</h2>
          {safe.body && <p>{safe.body}</p>}
          <div className="site-items">
            {safe.items.map((item, i) => (
              <div key={i} className="site-team-member">
                <span className="site-team-avatar" aria-hidden="true">
                  {item.label.charAt(0).toUpperCase()}
                </span>
                <span className="site-team-name">{item.label}</span>
                {item.detail && <span className="site-team-role">{item.detail}</span>}
              </div>
            ))}
          </div>
        </section>
      );

    case "pricing":
      return (
        <section id={safe.key} className="site-section site-section-pricing">
          <h2>{safe.title}</h2>
          {safe.body && <p>{safe.body}</p>}
          <div className="site-items">
            {safe.items.map((item, i) => (
              <div key={i} className="site-pricing-tier">
                <span className="site-pricing-name">{item.label}</span>
                {item.detail && <span className="site-pricing-detail">{item.detail}</span>}
              </div>
            ))}
          </div>
        </section>
      );

    case "timeline":
      return (
        <section id={safe.key} className="site-section site-section-timeline">
          <h2>{safe.title}</h2>
          {safe.body && <p>{safe.body}</p>}
          <div className="site-timeline">
            {safe.items.map((item, i) => (
              <div key={i} className="site-timeline-item">
                <span className="site-timeline-marker" aria-hidden="true" />
                <div className="site-timeline-body">
                  <span className="site-timeline-label">{item.label}</span>
                  {item.detail && <span className="site-timeline-detail">{item.detail}</span>}
                </div>
              </div>
            ))}
          </div>
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
