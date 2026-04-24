"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, LogOut, ChevronDown, User, Check, Key, FileText } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "superadmin" | "admin" | "moderator";
type Lang = "en" | "bn";

// ── Mock user (replace with real auth context later) ──────────────────────────

const MOCK_USER = {
  name: "কামাল বিল্লাহ",
  nameEn: "Kamal Billah",
  roles: ["superadmin", "admin", "moderator"] as Role[],
};

const ROLE_CONFIG: Record<Role, { label: string; className: string }> = {
  superadmin: { label: "Super Admin", className: "bg-purple-100 text-purple-700" },
  admin:      { label: "Admin",       className: "bg-blue-100   text-blue-700"   },
  moderator:  { label: "Moderator",   className: "bg-emerald-100 text-emerald-700" },
};

// ── Page title map ─────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/listing":           "Employees",
  "/listing/fixation":  "Salary Fixation",
};

// ── Flag SVGs ─────────────────────────────────────────────────────────────────

const FlagBD = () => (
  <svg viewBox="0 0 20 14" className="h-3.5 w-5 rounded-sm overflow-hidden">
    <rect width="20" height="14" fill="#006A4E" />
    <circle cx="9.5" cy="7" r="4" fill="#F42A41" />
  </svg>
);

const FlagGB = () => (
  <svg viewBox="0 0 20 14" className="h-3.5 w-5 rounded-sm overflow-hidden">
    <rect width="20" height="14" fill="#012169" />
    {/* Diagonals white */}
    <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" strokeWidth="3" />
    {/* Diagonals red */}
    <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.8" />
    {/* Cross white */}
    <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="5" />
    {/* Cross red */}
    <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="3" />
  </svg>
);

// ── Click-outside hook ────────────────────────────────────────────────────────

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

// ── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const pathname = usePathname();
  const [lang, setLang] = useState<Lang>("en");
  const [activeRole, setActiveRole] = useState<Role>(MOCK_USER.roles[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useClickOutside(closeMenu);
  const notifCount = 3;

  const pageTitle = PAGE_TITLES[pathname] ?? "Dashboard";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      {/* Page title */}
      <h2 className="text-sm font-semibold text-slate-800">{pageTitle}</h2>

      {/* Controls */}
      <div className="flex items-center gap-1">

        {/* ── Language toggle ── */}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 mr-1">
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
          {notifCount > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </button>

        {/* ── User menu ── */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {/* Avatar */}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <User size={14} className="text-primary" />
            </span>
            <span className="max-w-28 truncate font-medium font-bn-serif">
              {MOCK_USER.name}
            </span>
            <ChevronDown
              size={14}
              className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-100/80 py-1">

              {/* ── User info ── */}
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="font-medium text-slate-900 font-bn-serif leading-snug">
                  {MOCK_USER.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{MOCK_USER.nameEn}</p>
                <span
                  className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CONFIG[activeRole].className}`}
                >
                  {ROLE_CONFIG[activeRole].label}
                </span>
              </div>

              {/* ── Role switcher ── */}
              {MOCK_USER.roles.length > 1 && (
                <div className="border-b border-slate-100 px-2 py-2">
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Switch Role
                  </p>
                  {MOCK_USER.roles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setActiveRole(role)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CONFIG[role].className}`}
                      >
                        {ROLE_CONFIG[role].label}
                      </span>
                      {activeRole === role && (
                        <Check size={13} className="shrink-0 text-accent" />
                      )}
                    </button>
                  ))}
                </div>
              )}

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
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
