import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the auth session via Next's cookie store. Wrapped in
 * React.cache so a layout and the page(s) nested inside it share one
 * instance instead of each creating their own — see getCurrentUser below
 * for why that matters.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no response to write to —
            // safe to ignore since middleware refreshes the session too.
          }
        },
      },
    }
  );
});

/**
 * The current signed-in user, memoized per request. `auth.getUser()` makes
 * a real network round-trip to revalidate the session on every call — a
 * layout plus the page(s) nested inside it each calling it independently
 * was turning one page load into several sequential auth round-trips.
 * React.cache collapses those into one.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
