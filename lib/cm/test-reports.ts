/**
 * What the CM side may read of a laboratory's report (D147).
 *
 * One question, asked in one place, so the page, the PDF route and the
 * consolidated report cannot disagree about whether a report is the file's to
 * read. The crossing itself is `applicationIdForOrder()`; this is the *other*
 * half — whether the document is finished.
 */
import { prisma } from "@/lib/prisma";

/**
 * Is this order's report an approved document?
 *
 * **Approval is the line, not submission.** A draft on its way up the ladder is
 * the wing's own working paper: its figures can still be corrected and its
 * verdict is the testing officer's conclusion rather than the wing's. The same
 * rule D90 draws around an unsent inspection report — unfinished work is not
 * somebody else's to read — applied across the sample cut.
 *
 * Both `approvedAt` and `reportNo`, because a report the FDO acts on should be
 * a document he can quote, and the number is minted at approval (D133).
 */
export async function reportIsReadableByFile(orderId: number): Promise<boolean> {
  const report = await prisma.labTestReport.findUnique({
    where: { orderId },
    select: { approvedAt: true, reportNo: true },
  });
  return !!report?.approvedAt && !!report.reportNo;
}
