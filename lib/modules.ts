/**
 * Module registry — the modules that make up BSTI e-Services and the path each
 * one is mounted at. Used by the footer module switcher and the landing page.
 *
 * Adding a module = one entry here plus its `app/(group)/<path>` folder.
 */

export type ModuleKey =
  | "hr"
  | "store"
  | "workflow"
  | "accounts"
  | "inventory"
  | "admin";

export type ModuleDef = {
  key: ModuleKey;
  /** Route prefix. Every page in the module lives under it. */
  path: string;
  label: string;
  labelBn: string;
  /** One line for the landing page card. */
  blurb: string;
  /** Module theme class from globals.css. Empty for HR, which uses :root. */
  theme: string;
};

export const MODULES: readonly ModuleDef[] = [
  {
    key: "hr",
    path: "/hr",
    label: "HR",
    labelBn: "জনবল ব্যবস্থাপনা",
    blurb: "Employee records, personal data sheets, postings, salary and ID cards.",
    theme: "",
  },
  {
    key: "store",
    path: "/store",
    label: "Store",
    labelBn: "বিডিএস স্টোর",
    blurb: "Standards, certification marks and publications available to order.",
    theme: "ec-theme",
  },
  {
    key: "workflow",
    path: "/workflow",
    label: "Workflow",
    labelBn: "কর্মপ্রবাহ",
    blurb: "Projects, task assignment and approval tracking across wings.",
    theme: "workflow-theme",
  },
  {
    key: "accounts",
    path: "/accounts",
    label: "Accounts",
    labelBn: "হিসাব শাখা",
    blurb: "Transactions, invoices, payroll and financial reporting.",
    theme: "accounts-theme",
  },
  {
    key: "inventory",
    path: "/inventory",
    label: "Inventory",
    labelBn: "মজুদ ব্যবস্থাপনা",
    blurb: "Stock levels, suppliers and purchase orders for lab consumables.",
    theme: "inventory-theme",
  },
  {
    key: "admin",
    path: "/admin",
    label: "Admin",
    labelBn: "প্রশাসন",
    blurb: "User accounts, roles and system-wide configuration.",
    theme: "admin-theme",
  },
];

export function getModule(key: ModuleKey): ModuleDef {
  const found = MODULES.find((m) => m.key === key);
  if (!found) throw new Error(`Unknown module: ${key}`);
  return found;
}

/** The module that owns `pathname`, or null for the landing page and /login. */
export function moduleForPath(pathname: string): ModuleDef | null {
  return (
    MODULES.find(
      (m) => pathname === m.path || pathname.startsWith(`${m.path}/`),
    ) ?? null
  );
}
