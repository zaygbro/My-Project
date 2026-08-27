"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("idle");
      toast.error(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="fade-in-up w-full max-w-sm">
        <Link href="/" className="mb-10 block text-center text-lg font-extrabold uppercase tracking-tight">
          Francisity
        </Link>

        {status === "sent" ? (
          <div className="fade-in-up rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center">
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
              className="field-transition w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="press w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              <span className="inline-flex items-center justify-center gap-2">
                {status === "sending" && <span className="spinner" aria-hidden />}
                {status === "sending" ? "Sending…" : "Send sign-in link"}
              </span>
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
