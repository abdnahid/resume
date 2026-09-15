import type { ModuleNavItem } from "@/components/layout/ModuleNavbar";

/**
 * One definition, so every screen in the module highlights the same way.
 *
 * **Work orders are not here any more** (D137). `/labs` is what you maintain —
 * the catalogue, an office's coverage, the routing map, the registry of
 * laboratories — and a work order is a file you work, which belongs with the
 * other files at `/workflow/work-order`.
 */
export const LABS_NAV: ModuleNavItem[] = [
  { label: "Overview", href: "/labs" },
  { label: "Catalogue", href: "/labs/catalogue" },
  { label: "My office", href: "/labs/coverage" },
  { label: "Lab mapping", href: "/labs/mapping" },
  { label: "Laboratories", href: "/labs/registry" },
];
