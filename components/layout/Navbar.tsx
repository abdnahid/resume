"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  LogOut,
  ChevronDown,
  User,
  Key,
  FileText,
  Building2,
  Shield,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type DbRole = "superadmin" | "officeadmin" | "data_entry" | "employee";

export type SessionUser = {
  employeeId: string;
  role: string;
  nameBn: string;
  nameEn: string;
  designationBn: string;
  designationEn: string;
  officeBn: string;
  officeEn: string;
};

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  DbRole,
  { label: string; dot: string; badge: string }
> = {
  superadmin: {
    label: "Super Admin",
    dot: "bg-purple-500",
    badge: "bg-purple-50  text-purple-700  ring-purple-200",
  },
  officeadmin: {
    label: "Office Admin",
    dot: "bg-blue-500",
    badge: "bg-blue-50    text-blue-700    ring-blue-200",
  },
  data_entry: {
    label: "Data Entry",
    dot: "bg-amber-500",
    badge: "bg-amber-50   text-amber-700   ring-amber-200",
  },
  employee: {
    label: "Employee",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
};

function getRoleConfig(role: string) {
  return (
    ROLE_CONFIG[role as DbRole] ?? {
      label: role,
      dot: "bg-slate-400",
      badge: "bg-slate-50 text-slate-600 ring-slate-200",
    }
  );
}

// ─── Page title map ───────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/": "Personal Data Sheet",
  "/hr/listing": "Employees",
  "/hr/listing/fixation": "Salary Fixation",
  "/hr/listing/salary-heads": "Salary Heads",
  "/hr/listing/salary": "Processed Salary",
  "/hr/listing/bank-advice": "Bank Advice",
  "/hr/listing/id-cards": "ID Card Authorization",
  "/hr/listing/director-general": "Director General",
};

// ─── Change Password Modal ────────────────────────────────────────────────────

const INPUT_CLS = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirm, setConfirm]                 = useState("");
  const [saving, setSaving]                   = useState(false);
  const [error, setError]                     = useState("");
  const [success, setSuccess]                 = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) { setError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true); setError("");
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword });
      if (result.error) {
        setError(result.error.message ?? "Failed to change password");
        return;
      }
      setSuccess(true);
      setTimeout(onClose, 1500);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Change Password</h3>
          <button type="button" onClick={onClose} className="ml-3 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3 text-center">
            Password changed successfully!
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={INPUT_CLS} required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={INPUT_CLS} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT_CLS} required />
            </div>
            {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 cursor-pointer transition-colors">
                {saving ? "Saving…" : "Change Password"}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Click-outside hook ───────────────────────────────────────────────────────

function useClickOutside(cb: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cb]);
  return ref;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export default function Navbar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [lang, setLang] = useState<"en" | "bn">("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useClickOutside(closeMenu);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const pageTitle = PAGE_TITLES[pathname] ?? "Dashboard";
  const rc = getRoleConfig(user.role);

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  const displayName = lang === "bn" ? user.nameBn : user.nameEn;
  const displayDesignation =
    lang === "bn" ? user.designationBn : user.designationEn;
  const displayOffice = lang === "bn" ? user.officeBn : user.officeEn;

  return (
    <>
    {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} />}
    <header className="sticky top-0 z-50 shrink-0 print:hidden">
      {/* ── Utility Bar ── */}
      <div className="bg-primary text-primary-foreground/85">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-2 text-[12.5px] tracking-wide lg:px-10">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" strokeWidth={1.8} />
              Official BSTI Portal
            </span>
            <span className="hidden opacity-60 md:inline">|</span>
            <span className="hidden md:inline">
              Bangladesh Standards &amp; Testing Institution
            </span>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`cursor-pointer transition-colors hover:text-primary-foreground ${lang === "en" ? "text-primary-foreground" : "opacity-55 hover:opacity-100"}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("bn")}
              className={`cursor-pointer transition-colors hover:text-primary-foreground ${lang === "bn" ? "text-primary-foreground" : "opacity-55 hover:opacity-100"}`}
            >
              বাং
            </button>

            <span className="h-3 w-px bg-primary-foreground/25" />

            <button
              type="button"
              title="Logout"
              onClick={handleLogout}
              className="flex items-center gap-1.5 hover:text-primary-foreground cursor-pointer transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Nav ── */}
      <nav
        className={`border-b border-border bg-card transition-shadow ${
          scrolled ? "shadow-md" : "shadow-sm"
        }`}
      >
        <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_1fr_auto] items-center gap-8 px-5 py-3.5 lg:px-10">
          {/* Brand */}
          <Link href="/hr" className="flex items-center gap-3.5">
            <Image src="/bsti.svg" alt="BSTI Logo" width={60} height={60} />
            <div className="hidden flex-col border-l-2 border-border pl-3.5 leading-tight md:flex">
              <span className="font-display text-base font-semibold tracking-tight text-foreground">
                HR Management
              </span>
              <span className="mt-0.5 font-bn-serif text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
                BSTI e-Services
              </span>
            </div>
          </Link>

          {/* Page title */}
          <h2 className="hidden text-center text-sm font-semibold text-foreground md:block">
            {pageTitle}
          </h2>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            {/* Notifications */}
            <button
              type="button"
              title="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-body transition-colors hover:bg-secondary hover:text-primary cursor-pointer"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>

            <span className="mx-1 h-6 w-px bg-border" />

            {/* User menu */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary cursor-pointer"
              >
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <User size={14} className="text-primary" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${rc.dot}`}
                  />
                </span>
                <span
                  className={`max-w-32 truncate font-medium leading-none ${lang === "bn" ? "font-bn-serif text-base" : ""}`}
                >
                  {displayName}
                </span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-muted-foreground transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl shadow-black/5">
                  {/* Identity */}
                  <div className="border-b border-border px-4 py-3.5">
                    <p className="font-bn-serif text-base font-semibold leading-snug text-foreground">
                      {user.nameBn}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {user.nameEn}
                    </p>
                    <span
                      className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${rc.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${rc.dot}`} />
                      {rc.label}
                    </span>
                  </div>

                  {/* Job details */}
                  {(user.designationBn || user.officeBn) && (
                    <div className="space-y-2 border-b border-border px-4 py-3">
                      {user.designationBn && (
                        <div className="flex items-start gap-2.5">
                          <User
                            size={13}
                            className="mt-0.5 shrink-0 text-muted-foreground"
                          />
                          <div className="min-w-0">
                            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                              Designation
                            </p>
                            <p
                              className={`text-sm leading-snug text-foreground ${lang === "bn" ? "font-bn-serif" : ""}`}
                            >
                              {displayDesignation}
                            </p>
                          </div>
                        </div>
                      )}
                      {user.officeBn && (
                        <div className="flex items-start gap-2.5">
                          <Building2
                            size={13}
                            className="mt-0.5 shrink-0 text-muted-foreground"
                          />
                          <div className="min-w-0">
                            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                              Office
                            </p>
                            <p
                              className={`text-sm leading-snug text-foreground ${lang === "bn" ? "font-bn-serif" : ""}`}
                            >
                              {displayOffice}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Employee ID */}
                  <div className="border-b border-border px-4 py-2.5">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Employee ID
                    </p>
                    <p className="font-mono text-sm text-foreground">
                      {user.employeeId}
                    </p>
                  </div>

                  {/* Links */}
                  <div className="px-2 py-1.5">
                    <Link
                      href="/hr"
                      onClick={closeMenu}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <FileText
                        size={14}
                        className="shrink-0 text-muted-foreground"
                      />
                      My Resume
                    </Link>
                    <button
                      type="button"
                      onClick={() => { closeMenu(); setChangePwOpen(true); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted cursor-pointer"
                    >
                      <Key
                        size={14}
                        className="shrink-0 text-muted-foreground"
                      />
                      Reset Password
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
    </>
  );
}
