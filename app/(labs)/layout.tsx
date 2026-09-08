import Footer from "@/components/layout/Footer";
import { requireInternal } from "@/lib/auth-guard";

/**
 * The Laboratory module shell.
 *
 * Internal only, and guarded twice on purpose (D12): `/labs` is in
 * `INTERNAL_PREFIXES` so the edge middleware refuses from the signed cookie,
 * and this call re-reads the database, which is the authority. Miss the second
 * and a stale cookie gets in.
 */
export default async function LabsLayout({ children }: { children: React.ReactNode }) {
  await requireInternal("/labs");

  return (
    <div className="labs-theme flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Footer module="labs" audience="internal" />
    </div>
  );
}
