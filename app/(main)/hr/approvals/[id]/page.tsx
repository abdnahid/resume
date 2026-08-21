import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getEmployeeRecord } from "@/lib/db";
import { ArrowLeft, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";

import GovHeader           from "@/components/GovHeader";
import DocumentTitle       from "@/components/DocumentTitle";
import PersonalSection     from "@/components/PersonalSection";
import CurrentJobSection   from "@/components/CurrentJobSection";
import AddressSection      from "@/components/AddressSection";
import EducationSection    from "@/components/EducationSection";
import PostingSection      from "@/components/PostingSection";
import PromotionSection    from "@/components/PromotionSection";
import TrainingSection     from "@/components/TrainingSection";
import ForeignTrainingSection from "@/components/ForeignTrainingSection";
import PublicationSection  from "@/components/PublicationSection";
import AwardSection        from "@/components/AwardSection";
import Signatures          from "@/components/Signatures";
import PageFoot            from "@/components/PageFoot";
import Sheet               from "@/components/Sheet";

import ApprovalActions from "./_components/ApprovalActions";
import PrintButton     from "./_components/PrintButton";

export const metadata = { title: "Review Profile" };

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  submitted:      { label: "Pending Review", cls: "bg-amber-100 text-amber-700",   Icon: Clock },
  approved:       { label: "Approved",       cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  needs_revision: { label: "Needs Revision", cls: "bg-red-100 text-red-700",       Icon: AlertCircle },
};

export default async function ProfileReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/hr");

  const { id } = await params;

  const [record, employee] = await Promise.all([
    getEmployeeRecord(id).catch(() => null),
    prisma.employee.findUnique({
      where: { id },
      select: {
        profileStatus: true,
        profileRevisionNote: true,
        profileSubmittedAt: true,
        profileApprovedAt: true,
        profileApprovedBy: true,
      },
    }),
  ]);

  if (!record || !employee) notFound();

  const badge = STATUS_BADGE[employee.profileStatus];

  return (
    <>
      {/* ── Control bar (hidden on print) ───────────────────────────── */}
      <div className="no-print sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur px-6 py-3 flex items-center gap-4">
        <Link
          href="/hr/approvals"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
          All Approvals
        </Link>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{record.name.bn} <span className="font-normal text-muted-foreground">({record.name.en})</span></p>
          <p className="text-xs text-muted-foreground">{id} · {record.current_job?.office_bn ?? "—"}</p>
        </div>

        {badge && (
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${badge.cls}`}>
            <badge.Icon size={12} />
            {badge.label}
          </span>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <PrintButton employeeId={id} />
          <ApprovalActions
            employeeId={id}
            currentStatus={employee.profileStatus}
            revisionNote={employee.profileRevisionNote ?? ""}
          />
        </div>
      </div>

      {/* ── Revision note banner (hidden on print if approved) ──────── */}
      {employee.profileStatus === "needs_revision" && employee.profileRevisionNote && (
        <div className="no-print max-w-5xl mx-auto px-6 pt-4">
          <div className="p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-700 mb-1">Revision Requested</p>
            <p className="text-sm text-red-600">{employee.profileRevisionNote}</p>
          </div>
        </div>
      )}

      {/* ── PDS sheets ──────────────────────────────────────────────── */}
      <main className="flex flex-col items-center gap-5 px-5 py-8 pb-32">
        {/* Page 1 */}
        <Sheet>
          <GovHeader org={record.org} />
          <DocumentTitle />
          <PersonalSection personal={record} emergency={record.emergency_contact} />
          <CurrentJobSection job={record.current_job} />
          <AddressSection addresses={record.addresses} />
          <PageFoot page={1} total={3} />
        </Sheet>

        {/* Page 2 */}
        <Sheet>
          <GovHeader org={record.org} />
          <div className="mt-7">
            <EducationSection rows={record.education} />
            <PostingSection rows={record.work_history} />
            <PromotionSection rows={record.promotions} />
          </div>
          <PageFoot page={2} total={3} />
        </Sheet>

        {/* Page 3 */}
        <Sheet>
          <GovHeader org={record.org} />
          <div className="mt-7">
            <TrainingSection rows={record.trainings} />
            <ForeignTrainingSection rows={record.foreign_trainings} />
            <PublicationSection rows={record.publications} />
            <AwardSection rows={record.awards} />
          </div>
          <Signatures />
          <PageFoot page={3} total={3} />
        </Sheet>
      </main>
    </>
  );
}
