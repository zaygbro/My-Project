"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "./actions";

function NavLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`press hover-lift flex items-center gap-2.5 truncate rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-blue-950/40 font-semibold text-white"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export function Sidebar({
  email,
  sites,
  isDev,
  viewingAsRegular,
  showUpgradeNudge,
}: {
  email: string;
  sites: { id: string; name: string }[];
  isDev: boolean;
  viewingAsRegular: boolean;
  showUpgradeNudge: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const recentSites = sites.slice(0, 5);
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes — adjusting state
  // during render (not an effect) since this is state derived from a prop
  // change, per the project's set-state-in-effect convention.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  // Escape-to-close is a real side effect (a global listener), not derived
  // state, so it belongs in an effect.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Real Cmd/Ctrl+K: focus the search box if it's already on screen,
  // otherwise navigate to it — same destination the Search nav link uses.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.getElementById("site-search") as HTMLInputElement | null;
        if (input) input.focus();
        else router.push("/dashboard#site-search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
        aria-expanded={open}
        className="press fixed top-4 left-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950/90 backdrop-blur-sm md:hidden"
      >
        {/* Morphs hamburger -> X on open rather than sitting static while the
            drawer it controls changes state underneath it. */}
        <span className="relative block h-3.5 w-4" aria-hidden>
          <span
            className={`absolute left-0 top-0 h-[1.5px] w-4 bg-current transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "translate-y-[6.5px] rotate-45" : ""}`}
          />
          <span
            className={`absolute left-0 top-[6.5px] h-[1.5px] w-4 bg-current transition-opacity duration-200 ease-out motion-reduce:transition-none ${open ? "opacity-0" : "opacity-100"}`}
          />
          <span
            className={`absolute left-0 bottom-0 h-[1.5px] w-4 bg-current transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "-translate-y-[6.5px] -rotate-45" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      )}

      <aside
        className={`fade-in-up fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 px-3 py-5 transition-transform duration-200 ease-out motion-reduce:transition-none md:sticky md:top-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="press hover-lift mb-5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-base font-extrabold uppercase tracking-tight transition-colors hover:bg-neutral-900"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black font-mono text-sm font-bold text-blue-500">
            /
          </span>
          Francisity
        </Link>

      <nav className="space-y-1">
        <NavLink href="/dashboard" active={pathname === "/dashboard"} onNavigate={() => setOpen(false)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New site
        </NavLink>
        <NavLink href="/dashboard#site-search" active={false} onNavigate={() => setOpen(false)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <span className="flex-1">Search</span>
          <kbd className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
            Ctrl K
          </kbd>
        </NavLink>
      </nav>

      <div className="mt-5 flex-1 overflow-y-auto">
        {recentSites.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between px-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-neutral-600">Recent sites</p>
            </div>
            <div className="space-y-0.5">
              {recentSites.map((site) => (
                <NavLink
                  key={site.id}
                  href={`/dashboard/sites/${site.id}`}
                  active={pathname === `/dashboard/sites/${site.id}`}
                  onNavigate={() => setOpen(false)}
                >
                  <span className="truncate">{site.name}</span>
                </NavLink>
              ))}
            </div>
            {sites.length > recentSites.length && (
              <Link
                href="/dashboard#site-search"
                onClick={() => setOpen(false)}
                className="press mt-1 block truncate rounded-lg px-3 py-2 text-xs text-neutral-600 transition-colors hover:text-neutral-300"
              >
                View all {sites.length} sites →
              </Link>
            )}
          </div>
        )}

        <div className="mt-4">
          <NavLink
            href="/dashboard/settings"
            active={pathname.startsWith("/dashboard/settings")}
            onNavigate={() => setOpen(false)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.7.36 1.19 1.05 1.51 1.51V9a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </NavLink>
        </div>
      </div>

      {showUpgradeNudge && (
        <Link
          href="/dashboard/settings"
          onClick={() => setOpen(false)}
          className="press hover-lift mb-3 flex items-start gap-2.5 rounded-xl border border-blue-900 bg-blue-950/20 p-3 transition-colors hover:border-blue-700"
        >
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </span>
          <span>
            <p className="text-xs font-semibold text-white">Upgrade to Pro</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">Unlimited sites, rebuilds &amp; export</p>
          </span>
        </Link>
      )}

      <div className="border-t border-neutral-800 pt-3">
        {isDev && (
          <span className="mb-1.5 ml-3 inline-block rounded-full border border-blue-800 bg-blue-950/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-blue-400">
            {viewingAsRegular ? "Dev · viewing as regular" : "Dev"}
          </span>
        )}
        <div className="flex items-center gap-2 px-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-950/60 font-mono text-xs font-bold text-blue-400">
            {email.charAt(0).toUpperCase()}
          </span>
          <p className="truncate text-xs text-neutral-500">{email}</p>
        </div>
        <form action={signOut}>
          <button className="press mt-1 w-full rounded-lg px-3 py-2 text-left font-mono text-xs uppercase tracking-wide text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-white">
            Sign out
          </button>
        </form>
      </div>
      </aside>
    </>
  );
}
