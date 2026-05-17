import ModuleNavbar from "@/components/layout/ModuleNavbar";

const navItems = [
  { label: "Home",           href: "/"             },
  { label: "BDS",            href: "/bds",           hasDropdown: true },
  { label: "Just Published", href: "/just-published" },
  { label: "Best Sellers",   href: "/best-sellers"   },
  { label: "BDT ৳",          href: "/currency",      hasDropdown: true },
];

export default function Navbar() {
  return (
    <ModuleNavbar
      moduleName="BDS Portal"
      moduleSubtitle="BSTI e-Services"
      navItems={navItems}
      showCart
    />
  );
}
