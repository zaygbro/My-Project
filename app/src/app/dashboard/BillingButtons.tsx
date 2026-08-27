"use client";

import { useState } from "react";
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
    alert(data.error ?? "Something went wrong starting checkout.");
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
      className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
    >
      {loading ? "Redirecting…" : label}
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
          alert(data.error ?? "Something went wrong opening the billing portal.");
          setLoading(false);
        }
      }}
      disabled={loading}
      className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:border-neutral-500 disabled:opacity-50"
    >
      {loading ? "Opening…" : "Manage billing"}
    </button>
  );
}
