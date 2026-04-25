"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, LogOut, ChevronDown, User, Key, FileText, Building2 } from "lucide-react";
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

const ROLE_CONFIG: Record<DbRole, { label: string; dot: string; badge: string }> = {
  superadmin:  { label: "Super Admin",  dot: "bg-purple-500", badge: "bg-purple-50  text-purple-700  ring-purple-200"  },
  officeadmin: { label: "Office Admin", dot: "bg-blue-500",   badge: "bg-blue-50    text-blue-700    ring-blue-200"    },
  data_entry:  { label: "Data Entry",   dot: "bg-amber-500",  badge: "bg-amber-50   text-amber-700   ring-amber-200"   },
  employee:    { label: "Employee",     dot: "bg-emerald-500",badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role as DbRole] ?? {
    label: role,
    dot: "bg-slate-400",
    badge: "bg-slate-50 text-slate-600 ring-slate-200",
  };
}

// ─── Page title map ───────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/":                 "Personal Data Sheet",
  "/listing":          "Employees",
  "/listing/fixation": "Salary Fixation",
  "/listing/salary":   "Processed Salary",
};

// ─── Flag SVGs ────────────────────────────────────────────────────────────────

const FlagBD = () => (
  <svg viewBox="0 0 20 14" className="h-3.5 w-5 rounded-sm overflow-hidden">
    <rect width="20" height="14" fill="#006A4E" />
    <circle cx="9.5" cy="7" r="4" fill="#F42A41" />
  </svg>
);

const FlagGB = () => (
  <svg viewBox="0 0 20 14" className="h-3.5 w-5 rounded-sm overflow-hidden">
    <rect width="20" height="14" fill="#012169" />
    <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" strokeWidth="3" />
    <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.8" />
    <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="5" />
    <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="3" />
  </svg>
);

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
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useClickOutside(closeMenu);

  const pageTitle = PAGE_TITLES[pathname] ?? "Dashboard";
  const rc = getRoleConfig(user.role);

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  // Pick names based on active language
  const displayName = lang === "bn" ? user.nameBn : user.nameEn;
  const displayDesignation = lang === "bn" ? user.designationBn : user.designationEn;
  const displayOffice = lang === "bn" ? user.officeBn : user.officeEn;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">

      {/* Page title */}
      <h2 className="text-sm font-semibold text-slate-800">{pageTitle}</h2>

      <div className="flex items-center gap-1">

        {/* ── Language toggle ── */}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 mr-2">
          <button
            type="button"
            title="বাংলা"
            onClick={() => setLang("bn")}
            className={`flex items-center justify-center rounded-md px-2 py-1.5 transition-colors cursor-pointer ${
              lang === "bn" ? "bg-slate-100" : "hover:bg-slate-50"
            }`}
          >
            <FlagBD />
          </button>
          <button
            type="button"
            title="English"
            onClick={() => setLang("en")}
            className={`flex items-center justify-center rounded-md px-2 py-1.5 transition-colors cursor-pointer ${
              lang === "en" ? "bg-slate-100" : "hover:bg-slate-50"
            }`}
          >
            <FlagGB />
          </button>
        </div>

        {/* ── Notifications ── */}
        <button
          type="button"
          title="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <Bell size={18} />
        </button>

        {/* ── User menu ── */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {/* Avatar with role dot */}
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <User size={14} className="text-primary" />
              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${rc.dot}`} />
            </span>

            <span className={`max-w-32 truncate font-medium leading-none ${lang === "bn" ? "font-bn-serif text-base" : ""}`}>
              {displayName}
            </span>

            <ChevronDown
              size={14}
              className={`shrink-0 text-slate-400 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-100/80 py-1 overflow-hidden">

              {/* ── Identity block ── */}
              <div className="px-4 py-3.5 border-b border-slate-100">

                {/* Names */}
                <p className={`font-semibold text-slate-900 leading-snug font-bn-serif text-base`}>
                  {user.nameBn}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{user.nameEn}</p>

                {/* Role badge */}
                <span className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${rc.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${rc.dot}`} />
                  {rc.label}
                </span>
              </div>

              {/* ── Job details ── */}
              {(user.designationBn || user.officeBn) && (
                <div className="px-4 py-3 border-b border-slate-100 space-y-2">
                  {user.designationBn && (
                    <div className="flex items-start gap-2.5">
                      <User size={13} className="mt-0.5 shrink-0 text-slate-300" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Designation</p>
                        <p className={`text-sm text-slate-700 leading-snug ${lang === "bn" ? "font-bn-serif" : ""}`}>
                          {displayDesignation}
                        </p>
                      </div>
                    </div>
                  )}
                  {user.officeBn && (
                    <div className="flex items-start gap-2.5">
                      <Building2 size={13} className="mt-0.5 shrink-0 text-slate-300" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Office</p>
                        <p className={`text-sm text-slate-700 leading-snug ${lang === "bn" ? "font-bn-serif" : ""}`}>
                          {displayOffice}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Employee ID ── */}
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Employee ID</p>
                <p className="font-mono text-sm text-slate-700">{user.employeeId}</p>
              </div>

              {/* ── Links ── */}
              <div className="px-2 py-1.5">
                <Link
                  href="/"
                  onClick={closeMenu}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FileText size={14} className="shrink-0 text-slate-400" />
                  My Resume
                </Link>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Key size={14} className="shrink-0 text-slate-400" />
                  Reset Password
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Logout ── */}
        <button
          type="button"
          title="Logout"
          onClick={handleLogout}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
