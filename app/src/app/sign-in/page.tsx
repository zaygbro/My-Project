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
        <Link href="/" className="mb-10 block text-center text-lg font-extrabold uppercase tracking-tight">
          Francisity
        </Link>

        {status === "sent" || status === "verifying" ? (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-center text-sm text-neutral-400">
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
            <p className="text-center text-xs text-neutral-500">
              No password needed — we&rsquo;ll email you a one-time code.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
