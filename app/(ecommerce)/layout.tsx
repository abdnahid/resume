import Footer from "@/components/layout/Footer";

export default function ECLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ec-theme flex h-screen overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
