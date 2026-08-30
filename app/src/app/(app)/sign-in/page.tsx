"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/password";
import { safeNextPath } from "@/lib/redirects";
import { Logo } from "@/components/Logo";

type Method = "password" | "code";
type Intent = "signin" | "signup";
/** Terminal screens that replace the form once an email is on its way. */
type Sent = null | "code" | "confirm" | "reset";

const FIELD =
  "field-transition w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";
const LABEL = "block text-xs font-mono uppercase tracking-wide text-ink-faint";
const SUBMIT =
  "press w-full rounded-full bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-60";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-white">
          <span className="spinner" aria-hidden />
        </main>
      }
    >
      <SignInInner />
    </Suspense>
  );
}

function SignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preserve where the visitor was actually headed — proxy.ts puts it here
  // when it bounces someone away from a protected page. Sanitized because
  // this value is in a URL anyone can craft, and it ends up in both a
  // client-side navigation and Supabase's emailRedirectTo.
  const next = safeNextPath(searchParams.get("next"));

  const [method, setMethod] = useState<Method>("password");
  const [intent, setIntent] = useState<Intent>("signin");
  const [sent, setSent] = useState<Sent>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  function reset() {
    setSent(null);
    setCode("");
    setPassword("");
    setBusy(false);
  }

  async function handlePasswordSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) {
      // Supabase returns the same "Invalid login credentials" whether the
      // email is unknown or the password is wrong — that's deliberate (it
      // stops the form being used to discover who has an account), so the
      // message is passed through rather than "helpfully" narrowed.
      toast.error(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function handlePasswordSignUp(e: FormEvent) {
    e.preventDefault();

    const check = validatePassword(password);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // When email confirmation is on, signing up with an address that already
    // exists returns a decoy user with no identities rather than an error —
    // again to prevent account enumeration. Show the same "check your email"
    // screen a real signup gets, so this form can't be used to test whether
    // an address is registered.
    if (data.user && data.user.identities?.length === 0) {
      setSent("confirm");
      return;
    }

    // Confirmation disabled in Supabase: a session comes back immediately.
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }

    setSent("confirm");
  }

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSent("code");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Enter your email first, then choose “Forgot password”.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    // The recovery link lands on the callback, which exchanges it for a
    // session and forwards to the page that actually sets a new password.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSent("reset");
  }

  return (
    <main className="entry-glow flex min-h-screen items-center justify-center bg-background px-6 py-12 text-white">
      <div className="fade-in-up w-full max-w-sm">
        <Link
          href="/"
          className="press font-display mb-8 flex items-center justify-center gap-2 text-lg font-extrabold uppercase tracking-tight"
        >
          <Logo size={24} />
          Francisity
        </Link>

        <div className="rounded-2xl border border-hairline bg-surface p-8">
          {sent === "code" ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="mb-2 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                Code sent
              </div>
              <p className="text-sm text-ink-dim">
                Enter the code we sent to <strong className="text-white">{email}</strong>
              </p>
              <label htmlFor="code" className={LABEL}>
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
                className="field-transition w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
              <button type="submit" disabled={busy} className={SUBMIT}>
                <span className="inline-flex items-center justify-center gap-2">
                  {busy && <span className="spinner" aria-hidden />}
                  {busy ? "Verifying…" : "Verify code"}
                </span>
              </button>
              <button
                type="button"
                onClick={reset}
                className="w-full text-center text-xs text-ink-faint hover:text-white"
              >
                Use a different email
              </button>
            </form>
          ) : sent === "confirm" || sent === "reset" ? (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                Check your email
              </div>
              <p className="text-sm text-ink-dim">
                {sent === "confirm" ? (
                  <>
                    We&rsquo;ve sent a confirmation link to{" "}
                    <strong className="text-white">{email}</strong>. Click it to finish setting up your
                    account.
                  </>
                ) : (
                  <>
                    If <strong className="text-white">{email}</strong> has an account, a link to set a new
                    password is on its way.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={reset}
                className="w-full text-center text-xs text-ink-faint hover:text-white"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Method switch. Both are real sign-in paths, so neither is
                  buried behind an "advanced" affordance. */}
              <div
                role="group"
                aria-label="Sign-in method"
                className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-hairline bg-surface-2/60 p-1"
              >
                {(["password", "code"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    aria-pressed={method === m}
                    className={`press rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      method === m
                        ? "bg-hairline text-white"
                        : "text-ink-faint hover:text-white"
                    }`}
                  >
                    {m === "password" ? "Password" : "Email code"}
                  </button>
                ))}
              </div>

              <form
                onSubmit={
                  method === "code"
                    ? handleSendCode
                    : intent === "signin"
                      ? handlePasswordSignIn
                      : handlePasswordSignUp
                }
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label htmlFor="email" className={LABEL}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={FIELD}
                  />
                </div>

                {method === "password" && (
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor="password" className={LABEL}>
                        Password
                      </label>
                      {intent === "signin" && (
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          disabled={busy}
                          className="text-[11px] text-ink-faint underline underline-offset-2 hover:text-white disabled:opacity-60"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      id="password"
                      type="password"
                      // Tells a password manager to offer a new strong
                      // password on sign-up and the saved one on sign-in.
                      autoComplete={intent === "signup" ? "new-password" : "current-password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={FIELD}
                    />
                    {intent === "signup" && (
                      <p className="text-[11px] text-ink-faint">At least 8 characters.</p>
                    )}
                  </div>
                )}

                <button type="submit" disabled={busy} className={SUBMIT}>
                  <span className="inline-flex items-center justify-center gap-2">
                    {busy && <span className="spinner" aria-hidden />}
                    {method === "code"
                      ? busy
                        ? "Sending…"
                        : "Send code"
                      : intent === "signin"
                        ? busy
                          ? "Signing in…"
                          : "Sign in"
                        : busy
                          ? "Creating account…"
                          : "Create account"}
                  </span>
                </button>
              </form>

              {method === "password" ? (
                <p className="mt-4 text-center text-xs text-ink-faint">
                  {intent === "signin" ? "No account yet?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setIntent(intent === "signin" ? "signup" : "signin")}
                    className="text-accent underline underline-offset-2 hover:text-accent-hover"
                  >
                    {intent === "signin" ? "Create one" : "Sign in"}
                  </button>
                </p>
              ) : (
                <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" aria-hidden />
                  One-time code by email — no password needed
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
