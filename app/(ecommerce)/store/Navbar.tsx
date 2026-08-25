import ModuleNavbar from "@/components/layout/ModuleNavbar";

/**
 * Only real destinations. "Best sellers" and currency switching return once
 * purchases exist (step 3) — a nav link that goes nowhere is worse than none.
 */
export const STORE_NAV = {
  home: "/store",
  all: "/store/bds",
  justPublished: "/store/bds?sort=newest&days=50",
  mandatory: "/store/bds?mandatory=1",
} as const;

const navItems = [
  { label: "Home", href: STORE_NAV.home },
  { label: "All Standards", href: STORE_NAV.all },
  { label: "Just Published", href: STORE_NAV.justPublished },
  { label: "Mandatory (315)", href: STORE_NAV.mandatory },
];

/**
 * `activeHref` is passed by pages whose filters live in the query string —
 * three of these items share the /store/bds path.
 */
export default function Navbar({ activeHref }: { activeHref?: string }) {
  return (
    <ModuleNavbar
      moduleName="BDS Store"
      moduleSubtitle="BSTI e-Services"
      navItems={navItems}
      showCart
      activeHref={activeHref}
    />
  );
}
