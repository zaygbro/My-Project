"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loadAnonSite, saveAnonSite, clearAnonSite, type AnonSite } from "@/lib/anon-site";
import { recommendModel, type AiModelId } from "@/lib/ai/models";
import { ModelPicker } from "../dashboard/ModelPicker";
import { claimAnonymousSite } from "./actions";

type Mode = "loading" | "claiming" | "create" | "editor";

export default function TryPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [anonSite, setAnonSite] = useState<AnonSite | null>(null);

  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [manualModel, setManualModel] = useState<AiModelId | null>(null);
  const recommended = useMemo(() => recommendModel(brief), [brief]);
  const selectedModel = manualModel ?? recommended;

  const [body, setBody] = useState("");

  const [email, setEmail] = useState("");
  const [signupStatus, setSignupStatus] = useState<"idle" | "sending" | "sent">("idle");

  // On load: if someone just signed up (real session) and has a local trial
  // site sitting in this browser, save it for real and hand them off to the
  // dashboard. Otherwise, resume editing the local site, or start fresh.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const existing = loadAnonSite();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (user && existing) {
        setMode("claiming");
        const result = await claimAnonymousSite({
          name: existing.name,
          brief: existing.brief,
          model: existing.preferredModel,
          content: existing.content,
        });
        if (cancelled) return;

        if (result.error) {
          toast.error(result.error);
          setAnonSite(existing);
          setBody(existing.content[0]?.body ?? "");
          setMode("editor");
          return;
        }

        clearAnonSite();
        toast.success("Site saved to your account.");
        router.push(`/dashboard/sites/${result.siteId}`);
        return;
      }

      if (existing) {
        setAnonSite(existing);
        setBody(existing.content[0]?.body ?? "");
        setMode("editor");
      } else {
        setMode("create");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Give your site a name.");
      return;
    }
    const site: AnonSite = {
      name: trimmedName,
      brief: brief.trim(),
      preferredModel: selectedModel,
      content: [
        {
          key: "overview",
          title: "Overview",
          body: brief.trim() || `A new site called "${trimmedName}". Edit this section to get started.`,
        },
      ],
    };
    saveAnonSite(site);
    setAnonSite(site);
    setBody(site.content[0].body);
    setMode("editor");
  }

  function handleSaveSection(e: FormEvent) {
    e.preventDefault();
    if (!anonSite) return;
    const updated: AnonSite = {
      ...anonSite,
      content: anonSite.content.map((s) => (s.key === "overview" ? { ...s, body } : s)),
    };
    saveAnonSite(updated);
    setAnonSite(updated);
    toast.success("Saved in this browser — sign up to keep it for good.");
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setSignupStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/try` },
    });
    if (error) {
      setSignupStatus("idle");
      toast.error(error.message);
      return;
    }
    setSignupStatus("sent");
  }

  if (mode === "loading" || mode === "claiming") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="inline-flex items-center gap-2 text-sm text-neutral-400">
          <span className="spinner" aria-hidden />
          {mode === "claiming" ? "Saving your site to your new account…" : "Loading…"}
        </p>
      </main>
    );
  }

  if (mode === "create") {
    return (
      <main className="flex min-h-screen flex-col items-center bg-black px-6 py-16 text-white">
        <div className="fade-in-up w-full max-w-md">
          <Link href="/" className="mb-2 block text-center text-lg font-extrabold uppercase tracking-tight">
            Francisity
          </Link>
          <p className="mb-8 text-center text-sm text-neutral-400">
            Try it free, right now — no account needed. Sign up later only if you want to keep it.
          </p>
          <form
            onSubmit={handleCreate}
            className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950 p-5"
          >
            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
                Site name
              </label>
              <input
                id="name"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kyoto Coffee Roastery"
                className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="brief" className="mb-1 block text-xs font-mono uppercase tracking-wide text-neutral-500">
                Brief (optional)
              </label>
              <textarea
                id="brief"
                rows={2}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="A modern landing page for a minimalist coffee roastery in Kyoto…"
                className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-mono uppercase tracking-wide text-neutral-500">
                AI model for section drafts
              </label>
              <ModelPicker name="model" value={selectedModel} onChange={setManualModel} recommendedId={recommended} />
              <p className="mt-2 text-xs text-neutral-600">
                You can try this now; actually generating with it needs an account.
              </p>
            </div>
            <button
              type="submit"
              className="press w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600"
            >
              Start building
            </button>
          </form>
        </div>
      </main>
    );
  }

  // mode === "editor"
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="fade-in-up mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wide text-neutral-500">Trial site (not saved yet)</p>
            <h1 className="text-2xl font-bold">{anonSite?.name}</h1>
          </div>
          <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
            Francisity
          </Link>
        </div>

        <div className="rounded-xl border border-blue-900 bg-blue-950/20 p-4">
          {signupStatus === "sent" ? (
            <p className="text-sm text-neutral-300">
              Check <strong className="text-white">{email}</strong> for a link — click it in this same browser and
              your site will be saved automatically.
            </p>
          ) : (
            <form onSubmit={handleSignup} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-neutral-300">
                This site only lives in your browser right now. Sign up free to save it permanently.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="field-transition w-48 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={signupStatus === "sending"}
                  className="press whitespace-nowrap rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
                >
                  {signupStatus === "sending" ? "Sending…" : "Save my site"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <form onSubmit={handleSaveSection}>
            <label htmlFor="section-overview" className="mb-2 block text-xs font-mono uppercase tracking-wide text-neutral-500">
              Overview
            </label>
            <textarea
              id="section-overview"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="field-transition w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <div className="mt-3 flex items-center justify-end">
              <button
                type="submit"
                className="press rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600"
              >
                Save section
              </button>
            </div>
          </form>
          <p className="mt-2 text-xs text-neutral-600">Sign up above to unlock AI-generated drafts.</p>
        </div>
      </div>
    </main>
  );
}
