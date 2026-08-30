"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { SKILLS } from "@/lib/skills";

const TRY_CHIPS = [
  { label: "SaaS dashboard with dark mode", fill: "A SaaS dashboard with dark mode" },
  { label: "Art gallery portfolio", fill: "An art gallery portfolio" },
  { label: "Web3 crypto tracker", fill: "A Web3 crypto tracker" },
];

const ENGINES = [
  { index: "01", name: "Structure", desc: "Drafts information architecture, page hierarchy, and layout grid from the brief alone.", dur: "1.7s", delay: ".1s", done: "Done — 6.2s" },
  { index: "02", name: "Visual", desc: "Sets palette, type pairing, and component style so the draft holds together as one system.", dur: "1.4s", delay: ".35s", done: "Done — 5.8s" },
  { index: "03", name: "Copy", desc: "Writes headlines, body, and calls to action in the brief's voice — never placeholder text.", dur: "2.1s", delay: ".2s", done: "Done — 7.1s" },
  { index: "04", name: "Assurance", desc: "Checks contrast, responsive behavior, and broken states before a draft is ever shown.", dur: "1.55s", delay: ".5s", done: "Done — checks passed" },
];

const STEPS = [
  { num: "01", name: "Brief intake", desc: "Describe the site in plain language, or hand over a reference link or moodboard." },
  { num: "02", name: "Concurrent drafting", desc: "All four engines draft against the same brief in parallel, each proposing its strongest take." },
  { num: "03", name: "Reconciliation", desc: "The merge layer scores every candidate and assembles one cohesive, production-grade draft." },
  { num: "04", name: "Publish", desc: "Refine any section in plain English, connect your domain, and ship — SSL included." },
];

const NOTES = [
  { body: "Go from idea to a live, on-brand site before you lose momentum — no design or dev hire needed to get a first version in front of people.", who: "Indie hackers & founders" },
  { body: "Draft client concepts in minutes, then hand off a production-ready build instead of a static mockup that still needs to be coded.", who: "Agencies & freelancers" },
  { body: "Get a professional site — menus, booking pages, portfolios — without briefing a designer or learning a page builder.", who: "Small businesses" },
];

const SHOWCASE = [
  { name: "Aurora Studio", kind: "Architecture portfolio" },
  { name: "Nightform Records", kind: "Music label storefront" },
  { name: "Pulse Analytics", kind: "SaaS landing page" },
  { name: "Kindred Coffee Co.", kind: "E-commerce storefront" },
  { name: "Vertex Legal", kind: "Professional services site" },
  { name: "Lumen 3D Studio", kind: "Motion artist portfolio" },
];

function cssVars(vars: Record<string, string>): CSSProperties {
  return vars as CSSProperties;
}

function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="url(#logo-glow)" />
      <g transform="translate(7,7)">
        <rect x="32" y="20" width="15" height="60" fill="url(#logo-back)" />
        <rect x="32" y="20" width="38" height="15" fill="url(#logo-back)" />
        <rect x="32" y="46" width="29" height="14" fill="url(#logo-back)" />
      </g>
      <rect x="32" y="20" width="15" height="60" fill="url(#logo-front)" />
      <rect x="32" y="20" width="38" height="15" fill="url(#logo-front)" />
      <rect x="32" y="46" width="29" height="14" fill="url(#logo-front)" />
      <polygon points="32,20 47,20 32,45" fill="#ffffff" opacity="0.3" />
    </svg>
  );
}

export default function MarketingHome() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [briefValue, setBriefValue] = useState("");
  const [briefStatus, setBriefStatus] = useState<"idle" | "drafting" | "issued">("idle");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [councilRun, setCouncilRun] = useState(false);
  const [skillsQuery, setSkillsQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const briefInputRef = useRef<HTMLInputElement>(null);
  const navSentinelRef = useRef<HTMLDivElement>(null);
  const councilRef = useRef<HTMLDivElement>(null);

  // Sticky nav shadow once scrolled past the top sentinel.
  useEffect(() => {
    const sentinel = navSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      setNavScrolled(!entries[0].isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Reveal-on-scroll: a one-shot IntersectionObserver over every .reveal
  // element, matching the marketing site's original vanilla-JS behavior —
  // these elements never re-render after mount, so toggling their class
  // directly is safe and avoids re-implementing per-card state.
  useEffect(() => {
    const revealEls = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Council mechanism: runs once it scrolls into view.
  useEffect(() => {
    const mechanism = councilRef.current;
    if (!mechanism) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setCouncilRun(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );
    observer.observe(mechanism);
    return () => observer.disconnect();
  }, []);

  function replayCouncil() {
    const mechanism = councilRef.current;
    setCouncilRun(false);
    // Force reflow so re-adding the class restarts the CSS animations.
    requestAnimationFrame(() => {
      void mechanism?.offsetWidth;
      setCouncilRun(true);
    });
  }

  function handleBriefSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const val = briefValue.trim();
    if (!val) {
      briefInputRef.current?.focus();
      return;
    }
    setBriefStatus("drafting");
    setTimeout(() => {
      setBriefStatus("issued");
      setTimeout(() => {
        router.push(`/try?brief=${encodeURIComponent(val)}`);
      }, 1100);
    }, 1500);
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  const filteredSkills = SKILLS.filter((s) => {
    const q = skillsQuery.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
  });

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="logo-front" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#5fd4ff" />
          </linearGradient>
          <linearGradient id="logo-back" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#16264d" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <radialGradient id="logo-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      <a href="#top" className="skip-link">Skip to content</a>
      <div ref={navSentinelRef} id="navSentinel" aria-hidden="true" />

      <header className={`nav${navScrolled ? " nav-scrolled" : ""}`} id="nav">
        <div className="nav-inner">
          <a className="brand" href="#top">
            <span className="brand-mark"><Logo /></span>
            <span className="brand-name">Francisity</span>
          </a>
          <nav className="nav-links">
            <a href="#showcase">Showcase</a>
            <a href="#engines">Engine</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="nav-cta">
            <a href="/dashboard" className="btn btn-ghost">Dashboard</a>
            <a href="/try" className="btn btn-white">Start free<span className="btn-icon" aria-hidden="true">→</span></a>
          </div>
          <button
            className={`nav-burger${mobileOpen ? " open" : ""}`}
            id="navBurger"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="navMobile"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
        <div className={`nav-mobile${mobileOpen ? " open" : ""}`} id="navMobile">
          <a href="#showcase" onClick={() => setMobileOpen(false)}>Showcase</a>
          <a href="#engines" onClick={() => setMobileOpen(false)}>Engine</a>
          <a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing</a>
          <a href="/dashboard" className="btn btn-ghost" onClick={() => setMobileOpen(false)}>Dashboard</a>
          <a href="/try" className="btn btn-white" onClick={() => setMobileOpen(false)}>Start free<span className="btn-icon" aria-hidden="true">→</span></a>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero" id="brief">
          <div className="hero-inner">
            <div className="pill">
              <span className="pill-dot"></span>
              Now open — build free
            </div>

            <h1 className="hero-title">Describe your vision.<br />Watch the council build.</h1>
            <p className="hero-sub">One brief runs through four specialist engines at once — structure, visual, copy,
              and assurance — and Francisity reconciles their work into a single site.</p>

            <div className="engine-status-row">
              <span className="sr-only">Engines online:</span>
              {["Structure", "Visual", "Copy", "Assurance"].map((label, i) => (
                <span key={label} className="engine-status-item" style={cssVars({ "--delay": `${i * 0.6}s` })}>{label}</span>
              ))}
            </div>

            <form className="brief-bar" id="briefForm" onSubmit={handleBriefSubmit}>
              <span className="brief-slash">/</span>
              <input
                type="text"
                id="briefInput"
                ref={briefInputRef}
                value={briefValue}
                onChange={(e) => setBriefValue(e.target.value)}
                placeholder="A modern landing page for a minimalist coffee roastery in Kyoto…"
                autoComplete="off"
              />
              <span className="brief-cursor" aria-hidden="true"></span>
              <button type="submit" className="btn btn-accent" disabled={briefStatus !== "idle"}>
                {briefStatus === "idle" ? "Build" : briefStatus === "drafting" ? "Drafting…" : "Issued ✓"}
              </button>
            </form>

            <div className="try-row">
              <span className="try-label">Try:</span>
              {TRY_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setBriefValue(chip.fill);
                    briefInputRef.current?.focus();
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="fact-rail">
            <div className="fact"><span className="fact-title">4 engines</span><span className="fact-label">Draft every brief in parallel</span></div>
            <div className="fact"><span className="fact-title">Free to start</span><span className="fact-label">No credit card required</span></div>
            <div className="fact"><span className="fact-title">Custom domain</span><span className="fact-label">Included from Pro</span></div>
            <div className="fact"><span className="fact-title">Open now</span><span className="fact-label">No invite needed</span></div>
          </div>
        </section>

        {/* SHOWCASE */}
        <section className="showcase" id="showcase">
          <div className="section-head reveal">
            <span className="section-marker">(01) The Showcase</span>
            <h2>What a single brief can produce</h2>
            <p className="lede">Concept previews generated from a brief — not live customer sites yet. We&rsquo;ll swap
              these for real, opt-in examples as more sites go live.</p>
          </div>

          <div className="showcase-grid">
            {SHOWCASE.map((item) => (
              <article key={item.name} className="showcase-card reveal">
                <div className="showcase-thumb">
                  <svg viewBox="0 0 200 130" fill="none" aria-hidden="true">
                    <rect x="8" y="8" width="184" height="114" rx="8" stroke="#2A2A31" />
                  </svg>
                </div>
                <div className="showcase-meta">
                  <div className="showcase-index">Concept preview</div>
                  <h3>{item.name}</h3>
                  <p>{item.kind}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ENGINE */}
        <section className="engines" id="engines">
          <div className="section-head reveal">
            <span className="section-marker">(02) The Engine</span>
            <h2>A council, not one model guessing alone</h2>
            <p className="lede">Every brief runs through four specialists at once, then a reconciliation pass merges
              their strongest structure, copy, and visual system into one draft — instead of picking a single
              answer and discarding the rest.</p>
          </div>

          <div className={`council-mechanism${councilRun ? " council-run" : ""}`} id="councilMechanism" ref={councilRef}>
            <div className="engine-grid">
              {ENGINES.map((engine) => (
                <div key={engine.index} className="engine-card reveal">
                  <div className="engine-index">{engine.index}</div>
                  <h3>{engine.name}</h3>
                  <p>{engine.desc}</p>
                  <div className="engine-status" style={cssVars({ "--dur": engine.dur, "--delay": engine.delay })}>
                    <div className="engine-status-track"><span className="engine-status-fill"></span></div>
                    <div className="engine-status-label">
                      <span className="engine-status-text-draft">Drafting…</span>
                      <span className="engine-status-text-done">{engine.done}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="merge-rail" aria-hidden="true">
              <div className="merge-col"><span className="merge-drop" style={cssVars({ "--delay": "1.9s" })}></span></div>
              <div className="merge-col"><span className="merge-drop" style={cssVars({ "--delay": "1.85s" })}></span></div>
              <div className="merge-col"><span className="merge-drop" style={cssVars({ "--delay": "2.4s" })}></span></div>
              <div className="merge-col"><span className="merge-drop" style={cssVars({ "--delay": "2.15s" })}></span></div>
              <div className="merge-trunk"><span className="merge-trunk-fill"></span></div>
            </div>

            <div className="console reveal">
              <div className="console-bar">
                <span className="dot red"></span><span className="dot yellow"></span><span className="dot green"></span>
                <span className="console-title">council --build &quot;kyoto coffee roastery landing page&quot;</span>
              </div>
              <div className="console-body">
                <div className="console-line" style={cssVars({ "--d": "1.9s" })}><span className="ok">✓</span> structure &nbsp;drafted layout in 6.2s</div>
                <div className="console-line" style={cssVars({ "--d": "1.85s" })}><span className="ok">✓</span> visual &nbsp;&nbsp;&nbsp;&nbsp;set palette + type in 5.8s</div>
                <div className="console-line" style={cssVars({ "--d": "2.4s" })}><span className="ok">✓</span> copy &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;wrote hero + 4 sections in 7.1s</div>
                <div className="console-line" style={cssVars({ "--d": "2.15s" })}><span className="ok">✓</span> assurance &nbsp;passed contrast + responsive checks</div>
                <div className="console-line accent" style={cssVars({ "--d": "2.55s" })}>→ reconciling 4 drafts into one site…</div>
                <div className="console-line accent strong" style={cssVars({ "--d": "2.85s" })}>✓ issued in 41.3s — <a href="/try">preview →</a></div>
              </div>
            </div>

            <div className="reconciled">
              <div className="reconciled-chrome">
                <span className="dot red"></span><span className="dot yellow"></span><span className="dot green"></span>
                <span className="reconciled-url">kyoto-coffee.francisity.app</span>
              </div>
              <div className="reconciled-preview">
                <svg viewBox="0 0 440 190" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="438" height="188" rx="6" stroke="#232328" />
                  <line x1="1" y1="34" x2="439" y2="34" stroke="#232328" />
                  <circle cx="18" cy="17" r="3" fill="#3B82F6" />
                  <line x1="34" y1="17" x2="90" y2="17" stroke="#4A4A54" />
                  <line x1="330" y1="17" x2="422" y2="17" stroke="#2A2A31" />
                  <rect x="24" y="54" width="180" height="14" rx="2" fill="#2A2A31" />
                  <rect x="24" y="76" width="260" height="8" rx="2" fill="#1A1A1F" />
                  <rect x="24" y="90" width="220" height="8" rx="2" fill="#1A1A1F" />
                  <rect x="24" y="114" width="96" height="30" rx="5" fill="#3B82F6" />
                  <rect x="256" y="60" width="160" height="90" rx="6" stroke="#3B82F6" strokeOpacity="0.6" />
                </svg>
              </div>
            </div>

            <button type="button" className="council-replay" id="councilReplay" onClick={replayCouncil}>Run the council again ▸</button>
          </div>
        </section>

        {/* PROCESS */}
        <section className="process" id="process">
          <div className="section-head reveal">
            <span className="section-marker">(03) The Process</span>
            <h2>From brief to live site in four stages</h2>
          </div>
          <div className="step-grid">
            {STEPS.map((step) => (
              <div key={step.num} className="step-card reveal">
                <div className="step-num">{step.num}</div>
                <h3>{step.name}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="notes">
          <div className="section-head reveal">
            <span className="section-marker">(04) Who It&rsquo;s For</span>
            <h2>Built for people who need a site now</h2>
          </div>
          <div className="notes-grid">
            {NOTES.map((note) => (
              <div key={note.who} className="note reveal">
                <p>{note.body}</p>
                <footer>{note.who}</footer>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section className={`pricing${billingPeriod === "annual" ? " annual" : ""}`} id="pricing">
          <div className="section-head reveal">
            <span className="section-marker">(05) Pricing</span>
            <h2>Start free. Scale when you need to.</h2>
          </div>

          <div className="billing-toggle reveal" role="group" aria-label="Billing period">
            <button
              type="button"
              className={`billing-btn${billingPeriod === "monthly" ? " active" : ""}`}
              onClick={() => setBillingPeriod("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`billing-btn${billingPeriod === "annual" ? " active" : ""}`}
              onClick={() => setBillingPeriod("annual")}
            >
              Annual <span className="save-tag">2 months free</span>
            </button>
          </div>

          <div className="pricing-grid">
            <div className="price-card reveal">
              <h3>Spark</h3>
              <p className="price-desc">Try the council on a personal project.</p>
              <div className="price-amount">$0<span>/mo</span></div>
              <ul className="price-features">
                <li>3 sites</li>
                <li>5 rebuilds / month</li>
                <li>4-engine council, standard queue</li>
                <li>yoursite.francisity.app subdomain</li>
                <li className="feature-neutral">&quot;Built with Francisity&quot; badge</li>
                <li>Community support</li>
              </ul>
              <a href="/try" className="btn btn-ghost btn-block">Start free</a>
            </div>
            <div className="price-card featured reveal">
              <span className="price-badge">Most popular</span>
              <h3>Pro</h3>
              <p className="price-desc">For creators and small teams shipping real products.</p>
              <div className="price-amount">
                <span className="amount amount-monthly">$12<span>/mo</span></span>
                <span className="amount amount-annual">$120<span>/yr</span></span>
              </div>
              <ul className="price-features">
                <li>Unlimited sites &amp; rebuilds</li>
                <li>Priority build queue</li>
                <li>Custom domain + SSL</li>
                <li>Remove &quot;Built with Francisity&quot; badge</li>
                <li>Section-level rebuilds</li>
                <li>Export to code (HTML/CSS)</li>
              </ul>
              <a href="/try" className="btn btn-accent btn-block">Start building<span className="btn-icon" aria-hidden="true">→</span></a>
            </div>
            <div className="price-card reveal">
              <h3>Studio</h3>
              <p className="price-desc">For agencies building for clients at scale.</p>
              <div className="price-amount">
                <span className="amount amount-monthly">$39<span>/mo</span></span>
                <span className="amount amount-annual">$390<span>/yr</span></span>
              </div>
              <ul className="price-features">
                <li>Everything in Pro</li>
                <li>Multi-seat workspace</li>
                <li>Scheduled content refresh</li>
                <li>White-label export</li>
                <li>API access</li>
              </ul>
              <a href="/try" className="btn btn-ghost btn-block">Start building</a>
            </div>
          </div>

          <p className="pricing-note reveal">Prefer to pay as you go? Extra sites, one-off rebuilds, and rush builds
            that skip the queue will be available anytime, no subscription required.</p>
        </section>

        {/* SKILLS */}
        <section className="skills" id="skills">
          <div className="section-head reveal">
            <span className="section-marker">(06) Under the Hood</span>
            <h2>One brief, dozens of specialized skills</h2>
            <p className="lede">Every build draws on a real library of purpose-built AI skills — design taste, motion,
              copywriting, code review, and more. Grab any one of them as a reference for your own AI tools.</p>
          </div>
          <div className="skills-toolbar reveal">
            <input
              type="search"
              className="skills-search"
              placeholder="Search skills…"
              aria-label="Search skills"
              value={skillsQuery}
              onChange={(e) => setSkillsQuery(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => copyText(SKILLS.map((s) => `Skill: ${s.name}\nSource: ${s.source}\n${s.desc}`).join("\n\n"), "all")}
            >
              {copied === "all" ? "Copied ✓" : "Copy all"}
            </button>
          </div>
          <div className="skills-grid reveal" aria-live="polite">
            {filteredSkills.length === 0 ? (
              <p className="skills-empty">No skills match that search.</p>
            ) : (
              filteredSkills.map((s) => (
                <div key={s.name} className="skill-chip">
                  <span className="skill-name">{s.name}</span>
                  <p className="skill-desc">{s.desc}</p>
                  <div className="skill-foot">
                    <span className="skill-source">{s.source}</span>
                    <button
                      type="button"
                      className={`skill-copy${copied === s.name ? " copied" : ""}`}
                      onClick={() => copyText(`Skill: ${s.name}\nSource: ${s.source}\n\n${s.desc}`, s.name)}
                    >
                      {copied === s.name ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="cta" id="get-started">
          <div className="cta-inner reveal">
            <span className="section-marker center">(07) Get In</span>
            <h2>Your next site is one brief away.</h2>
            <p>No invite, no queue — describe it and the council starts drafting.</p>
            <a href="/try" className="btn btn-accent cta-start">Start building free<span className="btn-icon" aria-hidden="true">→</span></a>
            <p className="cta-note">Free to start. No credit card required.</p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="brand-row">
              <span className="brand-mark"><Logo /></span>
              <span className="brand-name">Francisity</span>
            </div>
            <p>Every site you can describe, built by a council of AI engines.</p>
          </div>
          <div className="footer-links">
            <div>
              <h4>Product</h4>
              <a href="#showcase">Showcase</a>
              <a href="#engines">Engine</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#top">About</a>
              <a href="/dashboard">Dashboard</a>
              <a href="#top">Contact</a>
            </div>
            <div>
              <h4>Account</h4>
              <a href="/sign-in">Sign in</a>
              <a href="/try">Start free</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">© 2026 Francisity. All rights reserved.</div>
      </footer>
    </>
  );
}
