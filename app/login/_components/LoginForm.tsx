"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, LogIn } from "lucide-react";

type OfficeOption = {
  id: number;
  nameBn: string;
  adminUsername: string | null;
};

function LoginFormInner({ officeOptions }: { officeOptions: OfficeOption[] }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedOfficeId, setSelectedOfficeId] = useState(
    String(officeOptions[0]?.id ?? "")
  );

  const selectedOffice = officeOptions.find(
    (o) => String(o.id) === selectedOfficeId
  );

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

  async function quickLogin(username: string, pwd: string) {
    setError("");
    setLoading(true);
    const { error } = await authClient.signIn.username({ username, password: pwd });
    if (error) {
      setError(error.message ?? "Login failed.");
      setLoading(false);
    } else {
      window.location.href = redirect;
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
              <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600 font-bn-serif">
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

            {/* Quick login */}
            <div className="pt-2 space-y-2">
              <p className="text-[10px] text-center text-slate-400 uppercase tracking-widest">
                Quick login (testing only)
              </p>

              {/* Office Admin by office */}
              {officeOptions.length > 0 && (
                <div className="space-y-1.5">
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

export default function LoginForm({ officeOptions }: { officeOptions: OfficeOption[] }) {
  return (
    <Suspense>
      <LoginFormInner officeOptions={officeOptions} />
    </Suspense>
  );
}
