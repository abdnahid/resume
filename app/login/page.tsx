"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, LogIn } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await authClient.signIn.username({
      username: employeeId.trim(),
      password,
    });
    if (error) {
      setError(error.message ?? "Invalid employee ID or password.");
      setLoading(false);
    } else {
      window.location.href = redirect;
    }
  }

  return (
    <section className="bg-linear-to-b from-accent to-background flex px-5">
      <div className="min-w-75 m-auto w-full">
        <div className="p-5">
          <div>
            <h1 className="mt-6 text-balance font-bn-serif text-xl font-semibold">
              Welcome back!
            </h1>
            <p className="text-muted-foreground font-bn-serif">
              Sign in to continue
            </p>
          </div>

          <hr className="mb-5 mt-6" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Employee ID */}
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
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-800 placeholder:text-slate-300 focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            {/* Password */}
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
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm text-slate-800 placeholder:text-slate-300 focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
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

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            {/* Submit */}
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

            {/* Dev shortcuts */}
            <div className="pt-2 space-y-2">
              <p className="text-[10px] text-center text-slate-400 uppercase tracking-widest">
                Quick login (testing only)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Super Admin", id: "20220010021" },
                  { label: "Office Admin", id: "19953010010" },
                  { label: "Employee", id: "20105010089" },
                ].map(({ label, id }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      setError("");
                      setLoading(true);
                      const { error } = await authClient.signIn.username({
                        username: id,
                        password: "bsti@123",
                      });
                      if (error) {
                        setError(error.message ?? "Login failed.");
                        setLoading(false);
                      } else {
                        window.location.href = redirect;
                      }
                    }}
                    className="py-1.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </form>
          <p className="text-center text-xs text-slate-400 mt-5">
            Bangladesh Standards and Testing Institution
          </p>
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
