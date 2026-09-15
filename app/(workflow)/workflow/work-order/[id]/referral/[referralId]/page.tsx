import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { orgForOffice } from "@/lib/db";
import { toBengaliDigits } from "@/lib/bengali";
import { actorFor } from "@/lib/workflow/inbox";
import { canViewOrder } from "@/lib/labs/board";
import { labActorFor } from "@/lib/labs/testing";
import { referralDocument } from "@/lib/labs/referral";
import ReferralDocument from "./ReferralDocument";

export const dynamic = "force-dynamic";

/**
 * One referral letter (D140).
 *
 * **Access is the order's**, not a rule of its own: `canViewOrder()` is the
 * same question every other lab screen asks, and a refusal is `notFound()`
 * (D71) rather than a 403, so nobody can enumerate which orders exist by
 * reading the status codes.
 *
 * Note it is read by anyone with standing on the order, not only by the officer
 * who issued it — unlike a sampling letter, which belongs to the person named
 * on it (D130). The difference is real: a sampling letter is addressed *to* a
 * BSTI officer, while this one is addressed to an outside laboratory, and
 * everybody working the order needs to know what went out and to whom.
 */
export default async function ReferralLetterPage({
  params,
}: {
  params: Promise<{ id: string; referralId: string }>;
}) {
  const { id, referralId } = await params;
  const orderId = Number(id);
  const refId = Number(referralId);
  if (!Number.isInteger(orderId) || !Number.isInteger(refId)) notFound();

  const viewer = await requireInternal(`/workflow/work-order/${id}/referral/${referralId}`);
  const actor = labActorFor(await actorFor(viewer));
  if (!(await canViewOrder(actor, orderId))) notFound();

  const r = await referralDocument(refId);
  // A referral reached through a different order's URL is not this order's.
  if (!r || r.order.id !== orderId) notFound();

  const org = orgForOffice({
    nameBn: r.order.office?.nameBn ?? "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
    addressBn: r.order.office?.addressBn ?? "",
    email: r.order.office?.email ?? null,
  });

  const bnDate = (d: Date) =>
    toBengaliDigits(
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
    );

  return (
    <ReferralDocument
      org={org}
      pdfHref={`/api/labs/referrals/${r.id}/pdf`}
      backHref={`/workflow/work-order/${orderId}`}
      referral={{
        referralNo: r.referralNo,
        issuedOn: bnDate(r.issuedAt),
        issuedBy: {
          name: r.issuedBy.nameEn,
          designation: r.issuedBy.designationBn ?? r.issuedBy.designationEn ?? null,
        },
        labName: r.labName,
        labAddress: r.labAddress,
        officeNameBn: r.order.office?.nameBn ?? "",
        orderCode: r.order.code,
        urgent: r.order.isUrgent,
        note: r.note,
        packageName: r.order.subProduct.nameBn ?? r.order.subProduct.nameEn,
        standard: r.order.subProduct.standardAsPrinted,
        specimens: r.order.specimens.map((s) => ({
          labCode: s.labCode,
          specimenNo: s.specimenNo,
        })),
        tests: r.items.map((i) => ({
          name: i.orderItem.parameter.nameBn ?? i.orderItem.parameter.nameEn,
          method: i.orderItem.parameter.method?.designation ?? null,
          limit: i.orderItem.parameter.limitText,
          subs: i.orderItem.parameter.subParameters.map((sp) =>
            sp.limitText ? `${sp.label} — ${sp.limitText}` : sp.label,
          ),
        })),
      }}
    />
  );
}
