import Footer from "@/components/layout/Footer";
import { requireInternal } from "@/lib/auth-guard";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  // Internal module — a client never gets here (D12).
  await requireInternal("/inventory");

  return (
    <div className="inventory-theme flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Footer module="inventory" audience="internal" />
    </div>
  );
}
