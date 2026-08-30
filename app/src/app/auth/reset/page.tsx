"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/password";
import { Logo } from "@/components/Logo";

const FIELD =
  "field-transition w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

/**
 * Where a password-recovery link lands, after /auth/callback has exchanged
 * it for a session. Reaching this page already signed in is the whole
 * mechanism — that recovery session is the proof the visitor controls the
 * mailbox, which is what authorises changing the password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setAuthorized(Boolean(user));
      setChecking(false);
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password !== confirm) {
      toast.error("Those two passwords don't match.");
      return;
    }
    const check = validatePassword(password);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="entry-glow flex min-h-screen items-center justify-center bg-black px-6 py-12 text-white">
      <div className="fade-in-up w-full max-w-sm">
        <Link
          href="/"
          className="press mb-8 flex items-center justify-center gap-2 text-lg font-extrabold uppercase tracking-tight"
        >
          <Logo size={24} />
          Francisity
        </Link>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-8">
          {checking ? (
            <p className="inline-flex items-center gap-2 text-sm text-neutral-400">
              <span className="spinner" aria-hidden />
              Checking your link…
            </p>
          ) : !authorized ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-neutral-400">
                This reset link has expired or has already been used. Request a new one and it&rsquo;ll work
                straight away.
              </p>
              <Link
                href="/sign-in"
                className="press inline-block w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h1 className="text-lg font-bold tracking-tight">Set a new password</h1>
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-mono uppercase tracking-wide text-neutral-500">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={FIELD}
                />
                <p className="text-[11px] text-neutral-600">At least 8 characters.</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm" className="block text-xs font-mono uppercase tracking-wide text-neutral-500">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={FIELD}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="press w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {busy && <span className="spinner" aria-hidden />}
                  {busy ? "Saving…" : "Update password"}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
