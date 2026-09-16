/**
 * The limits the applicant states, collected at the visit (D144).
 *
 * **Where the standard does not fix a value, somebody has to.** A tile's
 * breaking strength and a fabric's length read *as declared* in the
 * specification, so there is nothing to test against until the FDO asks the
 * applicant and writes the answer down. He is already at the factory settling
 * the sampling plan, which is the last moment before the jars are sealed and
 * the only one at which the question can still be put to the person who knows.
 *
 * **It is per application, which is the whole point** — two manufacturers of
 * the same tile declare different strengths, and the catalogue holds neither.
 *
 * Server half (D9); `lib/labs/limits.ts` holds the rules that need no database
 * and is shared with the bench, so the two sides ask the same question.
 */
import { prisma } from "@/lib/prisma";
import { needsDeclaredLimit } from "@/lib/labs/limits";

/** One line the applicant has to answer, and his answer if he has. */
export type DeclarableLeaf = {
  applicationSubProductId: number;
  subProductName: string;
  parameterId: number;
  parameterName: string;
  discipline: string;
  subParameterId: number | null;
  /** What the form asks against — the parameter, or one of its sub-parameters. */
  label: string;
  /** The catalogue's own wording, kept because a tolerance is part of the rule. */
  limitText: string | null;
  declaredValue: string | null;
  declaredByName: string | null;
  declaredAt: Date | null;
};

/**
 * Every leaf on this application that needs a declaration.
 *
 * **Driven by the sub-products actually found at the factory**, not by what the
 * applicant first declared: a line struck out at the visit (D91) is not tested,
 * so asking for its limits would be asking about a product nobody is making.
 *
 * The leaf rule again (D61) — a parameter with sub-parameters asks once per
 * sub-parameter, one without asks a single question of its own.
 */
export async function declarableLimitsFor(applicationId: number): Promise<DeclarableLeaf[]> {
  const subProducts = await prisma.applicationSubProduct.findMany({
    where: { applicationId, notInProductionAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      subProduct: {
        select: {
          nameEn: true,
          parameters: {
            orderBy: [{ ordinal: "asc" }, { id: "asc" }],
            select: {
              id: true, nameEn: true, discipline: true, limitText: true, limitKind: true,
              subParameters: {
                orderBy: { ordinal: "asc" },
                select: { id: true, label: true, limitText: true, limitKind: true },
              },
            },
          },
        },
      },
    },
  });

  const declared = await prisma.applicationDeclaredLimit.findMany({
    where: { applicationSubProduct: { applicationId } },
    select: {
      applicationSubProductId: true, parameterId: true, subParameterId: true,
      declaredValue: true, declaredAt: true,
      declaredBy: { select: { nameEn: true } },
    },
  });
  const key = (a: number, p: number, s: number | null) => `${a}:${p}:${s ?? "self"}`;
  const have = new Map(
    declared.map((d) => [key(d.applicationSubProductId, d.parameterId, d.subParameterId), d]),
  );

  const out: DeclarableLeaf[] = [];
  for (const sp of subProducts) {
    for (const p of sp.subProduct.parameters) {
      const leaves = p.subParameters.length
        ? p.subParameters.map((s) => ({
            subParameterId: s.id as number | null,
            label: `${p.nameEn} — ${s.label}`,
            limitText: s.limitText,
            limitKind: s.limitKind as string,
          }))
        : [
            {
              subParameterId: null as number | null,
              label: p.nameEn,
              limitText: p.limitText,
              limitKind: p.limitKind as string,
            },
          ];
      for (const leaf of leaves) {
        if (!needsDeclaredLimit(leaf)) continue;
        const d = have.get(key(sp.id, p.id, leaf.subParameterId));
        out.push({
          applicationSubProductId: sp.id,
          subProductName: sp.subProduct.nameEn,
          parameterId: p.id,
          parameterName: p.nameEn,
          discipline: p.discipline,
          subParameterId: leaf.subParameterId,
          label: leaf.label,
          limitText: leaf.limitText,
          declaredValue: d?.declaredValue ?? null,
          declaredByName: d?.declaredBy?.nameEn ?? null,
          declaredAt: d?.declaredAt ?? null,
        });
      }
    }
  }
  return out;
}

/**
 * Record — or clear — what the applicant stated for one leaf.
 *
 * **Refused unless the leaf actually delegates**, because a declared value
 * against a fixed requirement would overwrite the standard on the report with
 * whatever the manufacturer preferred it to be. The picker only offers the
 * leaves that need one, and a rule enforced where the button is holds only for
 * whoever used the button.
 *
 * Postgres treats nulls as distinct, so the unique index does not cover the
 * no-sub-parameter case and the lookup is done by hand — the same reason
 * `enterResult()` does it.
 */
export async function setDeclaredLimit(args: {
  applicationSubProductId: number;
  parameterId: number;
  subParameterId: number | null;
  declaredValue: string | null;
  employeeId?: string | null;
  note?: string | null;
}) {
  const parameter = await prisma.testParameter.findUnique({
    where: { id: args.parameterId },
    select: {
      nameEn: true, limitText: true, limitKind: true,
      subParameters: { select: { id: true, label: true, limitText: true, limitKind: true } },
    },
  });
  if (!parameter) throw new Error("No such test parameter.");

  const leaf = args.subParameterId
    ? parameter.subParameters.find((s) => s.id === args.subParameterId)
    : parameter;
  if (!leaf) throw new Error("No such sub-parameter on that test.");
  if (!needsDeclaredLimit(leaf)) {
    throw new Error(
      `“${parameter.nameEn}” has a limit in the standard, so there is nothing for the applicant to declare.`,
    );
  }

  const existing = await prisma.applicationDeclaredLimit.findFirst({
    where: {
      applicationSubProductId: args.applicationSubProductId,
      parameterId: args.parameterId,
      subParameterId: args.subParameterId,
    },
    select: { id: true },
  });

  const value = args.declaredValue?.trim() || null;
  // **Clearing is a delete, not an empty string**, for the same reason
  // withdrawing a capability is (D116): absence is what "he has not said" means,
  // and a blank row reads as an answer.
  if (!value) {
    if (existing) await prisma.applicationDeclaredLimit.delete({ where: { id: existing.id } });
    return { cleared: true };
  }

  if (existing) {
    await prisma.applicationDeclaredLimit.update({
      where: { id: existing.id },
      data: {
        declaredValue: value,
        declaredAt: new Date(),
        declaredByEmployeeId: args.employeeId ?? null,
        note: args.note?.trim() || null,
      },
    });
  } else {
    await prisma.applicationDeclaredLimit.create({
      data: {
        applicationSubProductId: args.applicationSubProductId,
        parameterId: args.parameterId,
        subParameterId: args.subParameterId,
        declaredValue: value,
        declaredByEmployeeId: args.employeeId ?? null,
        note: args.note?.trim() || null,
      },
    });
  }
  return { cleared: false, declaredValue: value };
}
