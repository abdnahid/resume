/**
 * The test report as a document (D145), in BSTI's own format.
 *
 * Modelled on the wing's printed form, which the client supplied: a masthead
 * naming the **wing** rather than the office, a two-column identification
 * block, the five-column results table, a conforms/does-not remark, three
 * signature blocks and five standing notes.
 *
 * **Readable at every stage, not only once approved.** The testing officer
 * wants to see what he is about to send up, and every desk above him wants to
 * read what it is being asked to sign. So the document renders from whatever
 * exists — a draft has no report number and unsigned blocks, and says so rather
 * than pretending.
 *
 * **Blind, like everything else here** (D71). It is built from the order, which
 * carries no application column (D70), so it names the package and the lab
 * codes and reaches no company. The identification block the paper form fills
 * with the manufacturer's name is therefore left for the CM side to supply
 * later — see `docs/sessions` — and the fields it would occupy say plainly that
 * they are not resolved yet rather than printing something false.
 */
import { prisma } from "@/lib/prisma";
import { memoOfficeLabel } from "@/lib/bengali";
import { overallVerdict } from "@/lib/labs/ladder";

/**
 * **Demo numbering, deliberately and visibly** — the client's instruction
 * (2026-09-16) while the real series are settled.
 *
 * The paper form carries two numbers this system does not generate: a lab
 * register number (`CH/ES-124/26-27`) and a government file reference
 * (`36.05.0000.503.38.008.24`). Both are derived from the wing and the year
 * here so a rendered report looks right, and both are marked on the page as
 * placeholders — a fabricated number that does not announce itself is the one
 * thing a government document must not carry.
 */
export function demoLabRegNo(discipline: string | null, orderCode: string, year: number) {
  const wing = discipline === "chemical" ? "CH" : "PH";
  const serial = orderCode.replace(/[^0-9]/g, "").slice(-3).padStart(3, "0");
  const yy = String(year).slice(-2);
  return `${wing}/ES-${serial}/${yy}-${Number(yy) + 1}`;
}

export function demoLabReferenceNo(officeId: number | null, year: number) {
  const tail = String(year).slice(-2);
  return `36.05.0000.503.38.${String(officeId ?? 8).padStart(3, "0")}.${tail}`;
}

export type ReportRow = {
  sl: number;
  description: string;
  standardLimit: string | null;
  /** True where the limit is the applicant's figure rather than the standard's. */
  isDeclared: boolean;
  result: string | null;
  verdict: string;
  method: string | null;
};

export type ReportSeal = {
  name: string;
  designation: string | null;
  wing: string | null;
  office: string;
  at: Date | null;
} | null;

export async function reportDocument(orderId: number) {
  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      state: true,
      isUrgent: true,
      receivedByWingAt: true,
      reportedAt: true,
      office: { select: { id: true, nameEn: true, nameBn: true, addressEn: true, phone: true } },
      lab: { select: { nameEn: true, discipline: true } },
      subProduct: {
        select: {
          nameEn: true,
          standardAsPrinted: true,
          product: { select: { nameEn: true } },
        },
      },
      specimens: {
        select: { labCode: true, specimenNo: true, conditionNote: true },
        orderBy: { specimenNo: "asc" },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          parameter: {
            select: {
              id: true, nameEn: true, limitText: true, limitKind: true, discipline: true,
              method: { select: { designation: true } },
              subParameters: {
                orderBy: { ordinal: "asc" },
                select: { id: true, label: true, limitText: true, limitKind: true },
              },
            },
          },
          referral: { select: { referral: { select: { referralNo: true, labName: true } } } },
          results: {
            select: { sampleId: true, subParameterId: true, observedValue: true, verdict: true },
          },
        },
      },
      report: {
        select: {
          reportNo: true, verdict: true, remarks: true,
          testedAt: true, checkedAt: true, authorisedAt: true, approvedAt: true,
          testedBy: { select: { nameEn: true } },
          checkedBy: { select: { nameEn: true } },
          authorisedBy: { select: { nameEn: true } },
          approvedBy: { select: { nameEn: true } },
        },
      },
    },
  });
  if (!order) return null;
  return order;
}

/**
 * One row per **result-bearing leaf** (D61) — which is what the paper form's
 * numbered rows already are: its seven lines are seven tests, not seven jars.
 *
 * **A single result column, because the form has one.** Our readings are per
 * specimen, so where several jars were read the values are joined; where they
 * all agree the value is printed once. That is a rendering choice and not a
 * model change, and it is the open question the client has still to settle.
 */
type DocOrder = NonNullable<Awaited<ReturnType<typeof reportDocument>>>;

export function reportRows(
  items: DocOrder["items"],
  declared: Map<string, string>,
  limitFor: (
    leaf: { limitKind: string | null; limitText: string | null },
    declaredValue: string | undefined,
  ) => string | null,
  key: (parameterId: number, subParameterId: number | null) => string,
): ReportRow[] {
  const rows: ReportRow[] = [];
  let sl = 0;
  for (const item of items) {
    const p = item.parameter;
    const leaves = p.subParameters.length
      ? p.subParameters.map((s) => ({
          subParameterId: s.id as number | null,
          description: `${p.nameEn} — ${s.label}`,
          limitKind: s.limitKind as string | null,
          limitText: s.limitText,
        }))
      : [
          {
            subParameterId: null as number | null,
            description: p.nameEn,
            limitKind: p.limitKind as string | null,
            limitText: p.limitText,
          },
        ];

    for (const leaf of leaves) {
      const mine = item.results.filter((r) => r.subParameterId === leaf.subParameterId);
      const values = [...new Set(mine.map((r) => r.observedValue?.trim()).filter(Boolean))];
      const verdicts = mine.map((r) => r.verdict as string);
      sl++;
      rows.push({
        sl,
        description: leaf.description,
        standardLimit: limitFor(leaf, declared.get(key(p.id, leaf.subParameterId))),
        isDeclared: leaf.limitKind === "declared",
        result: values.length ? values.join(" · ") : null,
        verdict: verdicts.length
          ? verdicts.includes("fail")
            ? "fail"
            : verdicts.every((v) => v === "pass")
              ? "pass"
              : verdicts.includes("inconclusive")
                ? "inconclusive"
                : "not_tested"
          : "not_tested",
        method: p.method?.designation ?? null,
      });
    }
  }
  return rows;
}

/** The overall line the form prints as its remark. */
export function conformsLine(rows: ReportRow[]): {
  verdict: "pass" | "fail" | "inconclusive" | "not_tested";
  text: string;
} {
  const v = overallVerdict(rows.map((r) => ({ label: r.description, verdict: r.verdict as never })));
  const text =
    v.verdict === "pass"
      ? "The sample conforms to the requirements of the specification in respect of above tests."
      : v.verdict === "fail"
        ? "The sample does not conform to the requirements of the specification in respect of above tests."
        : v.verdict === "inconclusive"
          ? "The results in respect of above tests are inconclusive."
          : "Testing is not complete — this is a draft and not a report.";
  return { verdict: v.verdict, text };
}

/**
 * The wing's own name for the masthead, as the paper form prints it.
 *
 * **Not read off `LabTestOrder.lab`**, which is null on every order in the
 * database — the bench is filled in by the office when it opens the box, and
 * for work sent out there is none (D116). So the discipline is worked out from
 * what the order actually contains, and where that is mixed — head office's
 * order on application 26 is chemical *and* physical — from the wing of
 * whoever signed it, which is the honest answer: the masthead names the wing
 * that produced the report.
 */
export function wingTitle(discipline: string | null | undefined): string {
  return discipline === "chemical"
    ? "CHEMICAL TESTING WING"
    : discipline === "physical"
      ? "PHYSICAL TESTING WING"
      : "TESTING WING";
}

/** What discipline this order is, from its tests rather than from a null bench. */
export function disciplineOfOrder(
  order: { lab: { discipline: string } | null; items: { parameter: { discipline: string } }[] },
): string | null {
  if (order.lab?.discipline) return order.lab.discipline;
  const kinds = [...new Set(order.items.map((i) => i.parameter.discipline))];
  return kinds.length === 1 ? kinds[0] : null;
}

export { memoOfficeLabel };
