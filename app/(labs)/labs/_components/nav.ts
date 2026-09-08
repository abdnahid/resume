import type { ModuleNavItem } from "@/components/layout/ModuleNavbar";

/** One definition, so every screen in the module highlights the same way. */
export const LABS_NAV: ModuleNavItem[] = [
  { label: "Overview", href: "/labs" },
  { label: "Catalogue", href: "/labs/catalogue" },
  { label: "My office", href: "/labs/coverage" },
  { label: "Lab mapping", href: "/labs/mapping" },
  { label: "Laboratories", href: "/labs/registry" },
];
