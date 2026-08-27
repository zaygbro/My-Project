"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 block text-center text-lg font-extrabold uppercase tracking-tight">
          Francisity
        </Link>

        {status === "sent" ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center">
            <p className="text-sm text-neutral-300">
              Check <strong className="text-white">{email}</strong> for a sign-in link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="email" className="block text-xs font-mono uppercase tracking-wide text-neutral-500">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            {status === "error" && (
              <p className="text-sm text-red-400">{errorMessage}</p>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-600 disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            <p className="text-center text-xs text-neutral-500">
              No password needed — we&rsquo;ll email you a one-time link.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
