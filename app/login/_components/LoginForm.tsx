"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  CLIENT_HOME,
  INTERNAL_HOME,
  clientIdentifierKind,
  isInternalPath,
  normalizeMobile,
} from "@/lib/auth-identity";
import { Eye, EyeOff, LogIn, Building2, User } from "lucide-react";

type OfficeOption = {
  id: number;
  nameBn: string;
  adminUsername: string | null;
};

type Lane = "client" | "staff";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all";

function LoginFormInner({
  officeOptions,
  showQuickLogin,
}: {
  officeOptions: OfficeOption[];
  showQuickLogin: boolean;
}) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  /**
   * Preselect the lane from where the visitor came. Someone bounced off `/hr`
   * is staff; anyone else is far more likely to be a client.
   */
  const [lane, setLane] = useState<Lane>(
    redirect && isInternalPath(redirect) ? "staff" : "client",
  );

  const [employeeId, setEmployeeId] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedOfficeId, setSelectedOfficeId] = useState(
    String(officeOptions[0]?.id ?? ""),
  );

  const selectedOffice = officeOptions.find(
    (o) => String(o.id) === selectedOfficeId,
  );

  function landing(forLane: Lane) {
    if (redirect) return redirect;
    return forLane === "staff" ? INTERNAL_HOME : CLIENT_HOME;
  }

  function switchLane(next: Lane) {
    setLane(next);
    setError("");
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result =
      lane === "staff"
        ? await authClient.signIn.username({
            username: employeeId.trim(),
            password,
          })
        : clientIdentifierKind(identifier) === "email"
          ? await authClient.signIn.email({
              email: identifier.trim().toLowerCase(),
              password,
            })
          : await authClient.signIn.phoneNumber({
              phoneNumber: normalizeMobile(identifier),
              password,
            });

    if (result.error) {
      setError(
        result.error.message ??
          (lane === "staff"
            ? "Invalid employee ID or password."
            : "Invalid mobile number, email or password."),
      );
      setLoading(false);
      return;
    }

    window.location.href = landing(lane);
  }

  async function quickLogin(username: string, pwd: string) {
    setError("");
    setLoading(true);
    const { error } = await authClient.signIn.username({
      username,
      password: pwd,
    });
    if (error) {
      setError(error.message ?? "Login failed.");
      setLoading(false);
    } else {
      window.location.href = landing("staff");
    }
  }

  function handleOfficeAdminLogin() {
    if (!selectedOffice) return;
    if (!selectedOffice.adminUsername) {
      setError("এই অফিসে কোনো অফিস অ্যাডমিন নেই।");
      return;
    }
    quickLogin(selectedOffice.adminUsername, "bsti@123");
  }

  return (
    <section className="bg-linear-to-b from-accent to-background flex px-5">
      <div className="min-w-75 m-auto w-full max-w-sm">
        <div className="p-5">
          <div>
            <h1 className="mt-6 text-balance font-bn-serif text-xl font-semibold">
              Welcome back!
            </h1>
            <p className="text-muted-foreground font-bn-serif">
              Sign in to continue
            </p>
          </div>

          {/* ── Lane picker ──
              Employee IDs and mobile numbers are both 11-digit numeric, so no
              single field can tell them apart. The choice has to be explicit. */}
          <div
            role="tablist"
            aria-label="Account type"
            className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
          >
            {(
              [
                { key: "client", label: "Client", Icon: User },
                { key: "staff", label: "BSTI Staff", Icon: Building2 },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={lane === key}
                onClick={() => switchLane(key)}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  lane === key
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {lane === "staff" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. 20105010089"
                  required
                  autoFocus
                  className={`${inputClass} font-mono`}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Mobile number or email
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="01712345678"
                  required
                  autoFocus
                  inputMode="email"
                  className={inputClass}
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Use the mobile number you registered with.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
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

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600 font-bn-serif">
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
                <LogIn size={15} />
              )}
              {loading ? "Signing in…" : "Sign In"}
            </button>

            {lane === "client" && (
              <p className="text-center text-xs text-slate-500">
                New here?{" "}
                <Link
                  href={
                    redirect
                      ? `/register?redirect=${encodeURIComponent(redirect)}`
                      : "/register"
                  }
                  className="font-semibold text-primary hover:underline"
                >
                  Create an account
                </Link>
              </p>
            )}

            {/* Development only — never rendered in a production build. */}
            {showQuickLogin && lane === "staff" && officeOptions.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-[10px] text-center text-slate-400 uppercase tracking-widest">
                  Quick login (dev only)
                </p>
                <select
                  value={selectedOfficeId}
                  onChange={(e) => {
                    setSelectedOfficeId(e.target.value);
                    setError("");
                  }}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] text-slate-700 bg-white focus:outline-none focus:border-slate-300 disabled:opacity-40 font-bn-serif"
                >
                  {officeOptions.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.nameBn}
                      {o.adminUsername ? "" : " — অ্যাডমিন নেই"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleOfficeAdminLogin}
                  className="w-full py-1.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {selectedOffice?.adminUsername
                    ? "Login as Office Admin"
                    : "No Office Admin"}
                </button>
              </div>
            )}
          </form>

          <p className="text-center text-xs text-slate-400 mt-5">
            Bangladesh Standards and Testing Institution
          </p>
        </div>
      </div>
    </section>
  );
}

export default function LoginForm(props: {
  officeOptions: OfficeOption[];
  showQuickLogin: boolean;
}) {
  return (
    <Suspense>
      <LoginFormInner {...props} />
    </Suspense>
  );
}
