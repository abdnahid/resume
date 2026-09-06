import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/auth-guard";
import { organizationsFor } from "@/lib/client/organization";
import ApplyPicker from "./_components/ApplyPicker";

export const metadata = { title: "Apply for a CM licence — BSTI e-Services" };

/**
 * Choosing what to apply for: a company, then one of its factories.
 *
 * The picker itself is a client component — a company or a factory may be
 * registered here rather than on the company pages, so the list changes under
 * the applicant's hands. What is read from the database stays here.
 */
export default async function NewApplicationPage() {
  const viewer = await requireClient("/public/applications/new");
  const organizations = await organizationsFor(viewer.id);

  // Nothing to apply with at all: send them to build a profile rather than
  // showing an empty picker — and the wizard returns them here when it is done.
  if (organizations.length === 0) {
    redirect(`/public/companies/new?next=${encodeURIComponent("/public/applications/new")}`);
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-14 lg:px-10">
      <Link
        href="/public/services/cm-licence"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        CM Quality Licence
      </Link>
      <h1 className="mt-4 font-display text-3xl font-medium text-foreground">
        Apply for a CM licence
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        One application covers one product made at one factory. Choose the factory first — its
        location decides which BSTI office handles your file. If the company or the factory is not
        listed, you can add it here.
      </p>

      <ApplyPicker organizations={organizations} />
    </div>
  );
}
