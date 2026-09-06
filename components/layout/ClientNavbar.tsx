import ModuleNavbar from "@/components/layout/ModuleNavbar";

/**
 * The navbar every client surface wears.
 *
 * Its counterpart is `app/(ecommerce)/store/Navbar.tsx` — same wrapper shape,
 * a different set of destinations. This one lists **citizen services**, never
 * the internal module grid (D14): showing a visitor the modules advertises
 * five places they get refused at.
 *
 * All five links resolve. The two account destinations send an anonymous
 * visitor to `/login` with a return URL rather than nowhere, which is the
 * designed behaviour for a surface staff and clients share — not a dead link.
 */
const navItems = [
  { label: "Home", href: "/" },
  { label: "Standards Store", href: "/store/bds" },
  { label: "CM Quality Licence", href: "/public/services/cm-licence" },
  { label: "My applications", href: "/public/applications" },
  { label: "My companies", href: "/public/companies" },
];

export default function ClientNavbar({ activeHref }: { activeHref?: string }) {
  return (
    <ModuleNavbar
      moduleName="e-Services"
      moduleSubtitle="BSTI"
      navItems={navItems}
      activeHref={activeHref}
    />
  );
}
