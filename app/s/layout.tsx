import { requireInternal } from "@/lib/auth-guard";

/**
 * The specimen resolver — where a QR on a jar lands.
 *
 * INTERNAL only, and enforced in both places D12 requires: `/s` is in
 * `INTERNAL_PREFIXES` so `middleware.ts` refuses at the edge from the signed
 * cookie, and this layout re-reads the database, which is the authority.
 * Middleware fails open when the cookie is unreadable; the layout is what
 * actually decides.
 */
export default async function SampleResolverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireInternal("/s");
  return children;
}
