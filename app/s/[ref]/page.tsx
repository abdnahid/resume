import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { resolveRef } from "@/lib/samples/resolve";
import { normalizeCode } from "@/lib/samples/codes";
import PageContainer from "@/components/PageContainer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Specimen — BSTI" };

/**
 * One jar, two answers.
 *
 * The token in the QR belongs to neither side, so what this page shows is
 * decided entirely by who is signed in. A viewer with no standing gets the same
 * "not found" as a viewer holding a token that never existed — a distinct 403
 * would tell anyone with a photographed label which codes are live.
 */
export default async function SpecimenPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const viewer = await requireInternal("/s");
  const { ref } = await params;

  const result = await resolveRef(normalizeCode(ref), {
    userId: viewer.id,
    employeeId: viewer.employeeId,
    role: viewer.role,
  });

  if (!result.ok) notFound();

  if (result.view.side === "lab") {
    const v = result.view;
    return (
      <PageContainer>
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Specimen
          </p>
          <h1 className="font-mono text-2xl font-bold text-foreground">{v.labCode}</h1>
          <p className="text-sm text-muted-foreground">
            {v.order.code} · specimen {v.specimenNo} · {v.state.replace(/_/g, " ")}
            {v.order.isUrgent ? " · URGENT" : ""}
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            {v.subProduct.nameEn}
          </h2>
          {v.subProduct.nameBn && (
            <p className="font-bn text-sm text-muted-foreground">{v.subProduct.nameBn}</p>
          )}
          {v.subProduct.standardAsPrinted && (
            <p className="mt-1 text-xs text-muted-foreground">
              {v.subProduct.standardAsPrinted}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
            Parameters for this laboratory
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-medium">Parameter</th>
                  <th className="px-5 py-2 font-medium">Method</th>
                  <th className="px-5 py-2 font-medium">Limit</th>
                </tr>
              </thead>
              <tbody>
                {v.parameters.map((p) => (
                  <Rows key={p.id} p={p} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          This specimen is identified by its code alone. Queries about it go to the
          One Stop counter, never to the applicant.
        </p>
      </PageContainer>
    );
  }

  const v = result.view;
  return (
    <PageContainer>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Specimen
        </p>
        <h1 className="font-mono text-2xl font-bold text-foreground">{v.cmCode}</h1>
        <p className="text-sm text-muted-foreground">
          {v.application.applicationNo ?? "unsubmitted"} · {v.organizationName}
        </p>
      </header>

      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <Cell label="Sub-product" value={v.subProduct} />
        <Cell
          label="Article"
          value={[v.sku.brandName, v.sku.variant, v.sku.grade].filter(Boolean).join(" · ")}
        />
        <Cell label="Box" value={`${v.consignment.code} · seal ${v.consignment.sealNo}`} />
        <Cell label="Destination" value={v.consignment.labName} />
        <Cell label="Box status" value={v.consignment.state.replace(/_/g, " ")} />
        <Cell label="Specimen status" value={v.sampleState.replace(/_/g, " ")} />
      </dl>

      <p className="text-xs text-muted-foreground">
        The laboratory testing this specimen is not shown, and does not see the
        applicant.
      </p>
    </PageContainer>
  );
}

function Rows({
  p,
}: {
  p: {
    nameEn: string;
    method: string | null;
    limitText: string | null;
    subParameters: { id: number; label: string; limitText: string | null }[];
  };
}) {
  if (p.subParameters.length === 0) {
    return (
      <tr className="border-t border-border">
        <td className="px-5 py-2 font-medium text-foreground">{p.nameEn}</td>
        <td className="px-5 py-2 text-muted-foreground">{p.method ?? "—"}</td>
        <td className="px-5 py-2 text-foreground">{p.limitText ?? "—"}</td>
      </tr>
    );
  }
  return (
    <>
      <tr className="border-t border-border">
        <td className="px-5 py-2 font-medium text-foreground" colSpan={2}>
          {p.nameEn}
        </td>
        <td className="px-5 py-2 text-muted-foreground">{p.method ?? "—"}</td>
      </tr>
      {p.subParameters.map((s) => (
        <tr key={s.id} className="border-t border-border/50">
          <td className="py-1.5 pl-10 pr-5 text-muted-foreground" colSpan={2}>
            {s.label}
          </td>
          <td className="px-5 py-1.5 text-foreground">{s.limitText ?? "—"}</td>
        </tr>
      ))}
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}
