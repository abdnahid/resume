import Link from "next/link";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { canEditRegistry } from "@/lib/labs/access";
import { coverage } from "@/lib/labs/mapping";
import { officeShortName } from "@/lib/labs/grid";
import { LABS_NAV } from "../_components/nav";
import LabToggle from "./LabToggle";

export const dynamic = "force-dynamic";

/**
 * Every laboratory BSTI has, and what each has said it can do.
 *
 * The 46 rows came from the organogram with none invented — 8 head-office
 * sections under the two testing wings, and 38 branch laboratories matched to
 * their office by city. A laboratory that does not exist in practice is
 * **closed here rather than deleted**: the organogram unit is real even where
 * the bench is not, and a lab closed this year may open next.
 */
export default async function RegistryPage() {
  const viewer = await requireInternal("/labs/registry");
  const [actor, c] = await Promise.all([actorFor(viewer), coverage()]);
  const canEdit = canEditRegistry({
    role: actor.role, employeeId: actor.employeeId, officeId: actor.officeId,
  });

  const byOffice = new Map<string, typeof c.labs>();
  for (const l of c.labs) {
    if (!byOffice.has(l.office)) byOffice.set(l.office, []);
    byOffice.get(l.office)!.push(l);
  }

  const closed = c.labs.filter((l) => !l.isActive).length;
  const silent = c.labs.filter((l) => l.isActive && l.declared === 0).length;

  return (
    <>
      <ModuleNavbar
        moduleName="Laboratory"
        moduleSubtitle="BSTI e-Services"
        navItems={LABS_NAV}
        activeHref="/labs/registry"
      />
      <PageContainer>
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Registry</p>
          <h1 className="mt-1 font-display text-3xl font-medium">Laboratories</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {c.labsTotal} laboratories, {c.labsActive} open. A laboratory has to declare what it
            can run before any office can send it a sample — that is what keeps the map from
            naming a bench that cannot do the test.
            {silent > 0 && (
              <>
                {" "}
                <strong>{silent}</strong> of the open laboratories have said nothing about
                themselves yet — what stands against them is the seed&rsquo;s stand-in, not their
                own answer.
              </>
            )}
          </p>
        </header>

        {closed > 0 && (
          <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {closed} laboratories are closed. Offices still routing to one are not silently
            repointed — moving somebody&rsquo;s samples somewhere they never chose would be
            worse than telling them — so those cells show as unusable on the map instead.
          </p>
        )}

        {[...byOffice].map(([office, labs]) => (
          <section key={office} className="rounded-2xl border border-border bg-card">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
              {office}
              <span className="ml-2 font-normal text-muted-foreground">
                {officeShortName(office)}
              </span>
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {labs.map((l) => (
                  <tr key={l.labId} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/labs/registry/${l.labId}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {l.lab}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                      {l.declared
                        ? `${l.declared.toLocaleString("en-BD")} tests declared`
                        : "nothing declared"}
                    </td>
                    <td className="w-40 px-5 py-2.5 text-right">
                      <LabToggle labId={l.labId} isActive={l.isActive} canEdit={canEdit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </PageContainer>
    </>
  );
}
