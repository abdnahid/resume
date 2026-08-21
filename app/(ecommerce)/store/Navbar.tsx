import ModuleNavbar from "@/components/layout/ModuleNavbar";

const navItems = [
  { label: "Home",           href: "/store"                },
  { label: "BDS",            href: "/store/bds",             hasDropdown: true },
  { label: "Just Published", href: "/store/just-published"   },
  { label: "Best Sellers",   href: "/store/best-sellers"     },
  { label: "BDT ৳",          href: "/store/currency",        hasDropdown: true },
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
