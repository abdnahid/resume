"use client";

import { useState } from "react";
import { CreditCard, Smartphone, Loader2, ShieldAlert } from "lucide-react";
import { formatPoisha } from "@/lib/payments/money";

/**
 * The sandbox gateway's hosted page.
 *
 * Deliberately styled as a *separate* thing from BSTI — a payer on a real
 * gateway has left the merchant's site, and a demo that hides that teaches the
 * wrong shape. The banner saying no money moves is not decoration: an unlabelled
 * fake payment screen is the one thing here that could genuinely mislead
 * someone.
 */
const METHODS = [
  { key: "bkash", label: "bKash", icon: Smartphone },
  { key: "nagad", label: "Nagad", icon: Smartphone },
  { key: "rocket", label: "Rocket", icon: Smartphone },
  { key: "visa", label: "Card", icon: CreditCard },
];

export default function SandboxCheckout({
  reference,
  amountPoisha,
  description,
  returnUrl,
  cancelUrl,
}: {
  reference: string;
  amountPoisha: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const [method, setMethod] = useState("bkash");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(outcome: "paid" | "failed" | "cancelled") {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch("/api/payments/sandbox/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, outcome, method }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "The sandbox rejected that.");
      // The gateway sends the browser back to whichever URL the merchant gave
      // it. Both already carry their own query string — appending `?cancelled=1`
      // here would produce a second `?` and lose the `next` that returns an
      // in-flow buyer to their application. Our server decides what it means.
      window.location.href = outcome === "cancelled" ? cancelUrl : returnUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
        <p className="text-sm text-amber-900 dark:text-amber-200">
          <strong className="font-semibold">Sandbox gateway.</strong> This is a simulation for
          testing. No money moves and no card or wallet is contacted.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Secure payment
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{reference}</p>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-50">
            {formatPoisha(amountPoisha)}
          </p>

          <p className="mb-2 mt-6 text-xs font-medium text-slate-500 dark:text-slate-400">
            Pay with
          </p>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const active = method === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-slate-300 text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {m.label}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="button"
            onClick={() => choose("paid")}
            disabled={busy !== null}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy === "paid" && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
            Pay {formatPoisha(amountPoisha)}
          </button>

          {/* Both failure paths are offered on purpose — a gateway that can only
              succeed cannot test the code that handles it not succeeding. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => choose("failed")}
              disabled={busy !== null}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-red-400 hover:text-red-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
            >
              Simulate failure
            </button>
            <button
              type="button"
              onClick={() => choose("cancelled")}
              disabled={busy !== null}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-400 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
