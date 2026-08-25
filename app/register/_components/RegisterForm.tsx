"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { CLIENT_HOME, isValidMobile } from "@/lib/auth-identity";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all";

function RegisterFormInner() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? CLIENT_HOME;

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isValidMobile(mobile)) {
      setError("Enter a valid Bangladeshi mobile number, e.g. 01712345678.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/client/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mobile, email: email || undefined, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create the account.");
      setLoading(false);
      return;
    }

    // Registration signs the client in, so go straight where they were headed.
    window.location.href = redirect;
  }

  return (
    <section className="bg-linear-to-b from-accent to-background flex px-5">
      <div className="min-w-75 m-auto w-full max-w-sm">
        <div className="p-5">
          <h1 className="mt-6 text-balance font-bn-serif text-xl font-semibold">
            Create your account
          </h1>
          <p className="text-muted-foreground font-bn-serif">
            You only need a mobile number to start.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Your name"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Mobile number
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                placeholder="01712345678"
                inputMode="numeric"
                className={inputClass}
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                This is how you will sign in.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Email{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Confirm password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Repeat your password"
                className={inputClass}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <UserPlus size={15} />
              )}
              {loading ? "Creating account…" : "Create account"}
            </button>

            <p className="text-center text-xs text-slate-500">
              Already registered?{" "}
              <Link
                href={
                  redirect !== CLIENT_HOME
                    ? `/login?redirect=${encodeURIComponent(redirect)}`
                    : "/login"
                }
                className="font-semibold text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>

          <p className="text-center text-xs text-slate-400 mt-5">
            BSTI staff sign in with their employee ID — no registration needed.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function RegisterForm() {
  return (
    <Suspense>
      <RegisterFormInner />
    </Suspense>
  );
}
