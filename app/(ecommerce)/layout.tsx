import Footer from "@/components/layout/Footer";

/**
 * The store is a public storefront, so it scrolls as a normal document rather
 * than in a fixed viewport pane — that keeps the sticky navbar and the footer
 * behaving the way visitors expect.
 */
export default function ECLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ec-theme flex min-h-screen flex-col bg-background">
      <main className="flex-1">{children}</main>
      <Footer module="store" />
    </div>
  );
}
