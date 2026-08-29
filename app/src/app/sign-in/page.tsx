"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying">("idle");

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      setStatus("idle");
      toast.error(error.message);
      return;
    }
    setStatus("sent");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setStatus("verifying");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

    if (error) {
      setStatus("sent");
      toast.error(error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="entry-glow flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="fade-in-up w-full max-w-sm">
        <Link
          href="/"
          className="press mb-8 flex items-center justify-center gap-2 text-lg font-extrabold uppercase tracking-tight"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black font-mono text-sm font-bold text-blue-500">
            /
          </span>
          Francisity
        </Link>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-8">
          {status === "sent" || status === "verifying" ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="mb-2 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-neutral-500">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
                Code sent
              </div>
              <p className="text-sm text-neutral-400">
                Enter the code we sent to <strong className="text-white">{email}</strong>
              </p>
              <label htmlFor="code" className="block text-xs font-mono uppercase tracking-wide text-neutral-500">
                Code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="field-transition w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                type="submit"
                disabled={status === "verifying"}
                className="press w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {status === "verifying" && <span className="spinner" aria-hidden />}
                  {status === "verifying" ? "Verifying…" : "Verify code"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setCode("");
                }}
                className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300"
              >
                Use a different email
              </button>
            </form>
          ) : (
            <form onSubmit={handleSendCode} className="space-y-4">
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
                className="field-transition w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="press w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {status === "sending" && <span className="spinner" aria-hidden />}
                  {status === "sending" ? "Sending…" : "Send code"}
                </span>
              </button>
              <div className="flex items-center justify-center gap-2 pt-1 font-mono text-[11px] uppercase tracking-wide text-neutral-600">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" aria-hidden />
                No password — one-time code by email
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
