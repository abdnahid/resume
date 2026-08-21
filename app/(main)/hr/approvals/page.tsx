import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Clock, CheckCircle2, AlertCircle, User } from "lucide-react";
import ApprovalsFilterBar from "./_components/ApprovalsFilterBar";

export const metadata = { title: "Profile Approvals" };

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  submitted:      { label: "Pending Review", cls: "bg-amber-50 text-amber-700 border-amber-200",      Icon: Clock },
  approved:       { label: "Approved",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  needs_revision: { label: "Needs Revision", cls: "bg-red-50 text-red-700 border-red-200",             Icon: AlertCircle },
  draft:          { label: "Draft",          cls: "bg-slate-50 text-slate-600 border-slate-200",       Icon: User },
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; officeId?: string; status?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/hr");

  const sp       = await searchParams;
  const q        = sp.q?.trim() ?? "";
  const officeId = sp.officeId ? parseInt(sp.officeId) : undefined;
  const status   = sp.status ?? "";

  const statusFilter = status
    ? [status]
    : ["submitted", "approved", "needs_revision"];

  const [employees, offices] = await Promise.all([
    prisma.employee.findMany({
      where: {
        profileStatus: { in: statusFilter },
        ...(officeId !== undefined ? { officeId } : {}),
        ...(q ? {
          OR: [
            { id: { contains: q } },
            { nameEn: { contains: q, mode: "insensitive" } },
            { nameBn: { contains: q } },
          ],
        } : {}),
      },
      select: {
        id: true, nameEn: true, nameBn: true,
        profileStatus: true, profileSubmittedAt: true,
        profileApprovedAt: true, profileApprovedBy: true,
        office: { select: { nameBn: true } },
        designationBn: true,
      },
      orderBy: [
        { profileStatus: "asc" },
        { profileSubmittedAt: "desc" },
      ],
    }),
    prisma.office.findMany({ orderBy: { id: "asc" }, select: { id: true, nameBn: true } }),
  ]);

  const pending = employees.filter((e) => e.profileStatus === "submitted");
  const history = employees.filter((e) => e.profileStatus !== "submitted");

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Profile Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve employee-submitted profile data before it is applied to official documents.
        </p>
      </div>

      <ApprovalsFilterBar offices={offices} />

      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Awaiting Review ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((emp) => <EmployeeRow key={emp.id} emp={emp} />)}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            History ({history.length})
          </h2>
          <div className="space-y-2">
            {history.map((emp) => <EmployeeRow key={emp.id} emp={emp} />)}
          </div>
        </div>
      )}

      {employees.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No matching submissions found.</p>
        </div>
      )}
    </div>
  );
}

type EmpRow = {
  id: string; nameEn: string; nameBn: string;
  profileStatus: string;
  profileSubmittedAt: Date | null;
  profileApprovedAt: Date | null;
  profileApprovedBy: string | null;
  office: { nameBn: string } | null;
  designationBn: string | null;
};

function EmployeeRow({ emp }: { emp: EmpRow }) {
  const badge = STATUS_BADGE[emp.profileStatus] ?? STATUS_BADGE.draft;
  const Icon = badge.Icon;

  return (
    <Link
      href={`/hr/approvals/${emp.id}`}
      className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {emp.nameBn} <span className="text-muted-foreground font-normal">({emp.nameEn})</span>
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {emp.id} · {emp.office?.nameBn ?? "—"} · {emp.designationBn ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {emp.profileSubmittedAt && `Submitted: ${new Date(emp.profileSubmittedAt).toLocaleDateString("en-GB")}`}
          {emp.profileApprovedAt && ` · Decided: ${new Date(emp.profileApprovedAt).toLocaleDateString("en-GB")}`}
          {emp.profileApprovedBy && ` · By: ${emp.profileApprovedBy}`}
        </p>
      </div>
      <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${badge.cls}`}>
        <Icon size={12} />
        {badge.label}
      </span>
    </Link>
  );
}
