"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "./actions";

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`press block truncate rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-blue-950/40 font-semibold text-white"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export function Sidebar({ email, sites }: { email: string; sites: { id: string; name: string }[] }) {
  const pathname = usePathname();

  return (
    <aside className="fade-in-up sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 px-3 py-6">
      <Link href="/dashboard" className="mb-6 block px-3 text-base font-extrabold uppercase tracking-tight">
        Francisity
      </Link>

      <nav className="flex-1 space-y-4 overflow-y-auto">
        <div>
          <NavLink href="/dashboard" active={pathname === "/dashboard"}>
            Dashboard
          </NavLink>
        </div>

        {sites.length > 0 && (
          <div>
            <p className="mb-1 px-3 font-mono text-[10px] uppercase tracking-wide text-neutral-600">
              Your sites
            </p>
            <div className="space-y-0.5">
              {sites.map((site) => (
                <NavLink
                  key={site.id}
                  href={`/dashboard/sites/${site.id}`}
                  active={pathname === `/dashboard/sites/${site.id}`}
                >
                  {site.name}
                </NavLink>
              ))}
            </div>
          </div>
        )}

        <div>
          <NavLink href="/dashboard/settings" active={pathname.startsWith("/dashboard/settings")}>
            Settings
          </NavLink>
        </div>
      </nav>

      <div className="border-t border-neutral-800 pt-3">
        <p className="truncate px-3 text-xs text-neutral-500">{email}</p>
        <form action={signOut}>
          <button className="press mt-1 w-full rounded-lg px-3 py-2 text-left font-mono text-xs uppercase tracking-wide text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-white">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
