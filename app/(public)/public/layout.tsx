import ClientNavbar from "@/components/layout/ClientNavbar";
import Footer from "@/components/layout/Footer";

/**
 * The shell every client surface shares — navbar, page, footer.
 *
 * It lives here rather than in each page because it was in *none* of them: the
 * dashboard, the applications and the company profiles each rendered their own
 * `min-h-screen` column and their own footer, and no navbar at all. So a client
 * who opened their own application had no way back to the store, no account
 * menu, and no sign-out.
 *
 * Pages supply only their content and their own width — most sit in a 1100px
 * column, the narrower forms in 900px — so the width stays a property of the
 * page, as it is on the internal side.
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ClientNavbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
