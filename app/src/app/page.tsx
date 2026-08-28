import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="entry-glow flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <div className="fade-in-up max-w-lg">
        <p className="mb-2 text-lg font-extrabold uppercase tracking-tight">Francisity</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Build a site. Try it free — no account needed yet.</h1>
        <p className="mt-4 text-neutral-400">
          Write a brief, edit the copy, see it come together. When you&rsquo;re ready to keep it, sign up in one
          click and we&rsquo;ll save everything you made.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/try"
            className="press hover-lift w-full rounded-xl bg-blue-500 px-6 py-3 text-sm font-bold text-white hover:bg-blue-600 sm:w-auto"
          >
            Try it now — no sign-up
          </Link>
          <Link
            href="/sign-in"
            className="press w-full rounded-xl border border-neutral-800 px-6 py-3 text-sm font-bold text-neutral-300 hover:border-neutral-600 sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
