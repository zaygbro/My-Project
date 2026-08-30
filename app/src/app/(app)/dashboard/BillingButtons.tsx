"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { BillingPeriod } from "@/lib/plans";

async function goToCheckout(plan: "pro" | "studio", period: BillingPeriod) {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, period }),
  });
  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  } else {
    toast.error(data.error ?? "Something went wrong starting checkout.");
  }
}

export function UpgradeButton({
  plan,
  period,
  label,
}: {
  plan: "pro" | "studio";
  period: BillingPeriod;
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        setLoading(true);
        await goToCheckout(plan, period);
        setLoading(false);
      }}
      disabled={loading}
      className="press rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"
    >
      <span className="inline-flex items-center gap-2">
        {loading && <span className="spinner" aria-hidden />}
        {loading ? "Redirecting…" : label}
      </span>
    </button>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        setLoading(true);
        const res = await fetch("/api/stripe/portal", { method: "POST" });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          toast.error(data.error ?? "Something went wrong opening the billing portal.");
          setLoading(false);
        }
      }}
      disabled={loading}
      className="press rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-ink-dim disabled:opacity-50"
    >
      <span className="inline-flex items-center gap-2">
        {loading && <span className="spinner" aria-hidden />}
        {loading ? "Opening…" : "Manage billing"}
      </span>
    </button>
  );
}
