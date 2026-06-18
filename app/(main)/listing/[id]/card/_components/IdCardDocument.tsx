"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, User, Phone, PhoneCall, Calendar, Droplet } from "lucide-react";
import type { EmployeeRecord, IdCardAuthorization } from "@/lib/types";

const INSTRUCTIONS = [
  "This ID card is not transferable.",
  "In case of missing this card, please inform the nearest police station.",
  "If it is found, then please submit it to the nearest police station.",
  "After expiry of this card, submit it at Head Office, BSTI, Dhaka.",
  "It is prohibited to copy. Illegal Transfer/use is Punishable.",
  "If resigned from the service, then this card should be handed over to BSTI Authority.",
];

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-rule py-1.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
        <Icon size={13} strokeWidth={1.8} />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-2 flex-1">{label}</span>
      <span className="text-[11px] font-medium text-ink">{value || "N/A"}</span>
    </div>
  );
}

export default function IdCardDocument({
  record,
  authorization,
  canManage,
}: {
  record: EmployeeRecord;
  authorization: IdCardAuthorization | null;
  canManage: boolean;
}) {
  const router = useRouter();

  const mobile = record.mobile_office || record.mobile_home || "";
  const emergency = record.emergency_contact.mobile || record.emergency_contact.phone || "";
  const issuedOn = authorization?.issueDate ?? null;

  return (
    <div className="min-h-screen bg-muted py-8 px-4 print:bg-white print:p-0 print:min-h-0">
      {/* Toolbar */}
      <div className="print:hidden max-w-3xl mx-auto flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-title">ID Card</h1>
            <p className="text-sm text-muted-foreground font-bn-serif">{record.name.bn}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Printer size={15} />
          Print
        </button>
      </div>

      {/* Not-authorized notice */}
      {!authorization && (
        <div className="print:hidden max-w-3xl mx-auto mb-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          {canManage ? (
            <>
              This employee has no authorized ID card yet. Place them in an{" "}
              <a href="/listing/id-cards" className="font-semibold underline">ID card batch</a> to
              issue one — the preview below shows placeholder authorization.
            </>
          ) : (
            <>This employee has no authorized ID card yet.</>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="mx-auto flex flex-wrap items-start justify-center gap-6">
        {/* ── Front ── */}
        <div className="w-[340px] rounded-2xl border border-rule bg-paper shadow-md print:shadow-none overflow-hidden flex flex-col">
          {/* Letterhead */}
          <div className="px-5 pt-5 text-center">
            <Image src="/bsti.svg" alt="BSTI" width={44} height={44} className="mx-auto" />
            <p className="mt-2 text-[10px] font-bold leading-tight text-ink">
              Govt. of the People&apos;s Republic of Bangladesh
            </p>
            <p className="text-[10px] font-bold leading-tight text-ink">Ministry of Industries</p>
            <p className="text-[10px] font-bold leading-tight text-ink">
              Bangladesh Standards &amp; Testing Institution
            </p>
            <p className="text-[9px] leading-tight text-ink-3">
              Maan Bhaban, 116-A, Tejgaon I/A, Dhaka-1208
            </p>
          </div>

          {/* Brand band */}
          <div className="mt-3 bg-primary text-primary-foreground px-5 py-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
              <Image src="/bsti.svg" alt="" width={16} height={16} />
            </span>
            <span className="text-lg font-bold tracking-wide">BSTI</span>
          </div>

          {/* Photo */}
          <div className="flex justify-center py-4">
            <div className="photo-stripes h-28 w-24 rounded-md border border-rule-strong flex items-center justify-center overflow-hidden">
              <User size={44} className="text-ink-4" strokeWidth={1.4} />
            </div>
          </div>

          {/* Identity */}
          <div className="px-5 text-center">
            <span className="inline-block rounded-md border-2 border-primary px-3 py-1 text-[12px] font-bold text-primary">
              ID No: {record.id}
            </span>
            <p className="mt-2 text-base font-bold uppercase text-ink leading-tight">{record.name.en}</p>
            <p className="text-[12px] text-ink-2 leading-tight">{record.current_job.designation_en || "—"}</p>
          </div>

          {/* Signature / authorization */}
          <div className="px-5 pt-4 pb-5 mt-auto text-center">
            <div className="mx-auto h-10 w-40 flex items-end justify-center">
              {authorization?.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={authorization.signatureUrl} alt="Signature" className="max-h-10 max-w-full object-contain" />
              ) : null}
            </div>
            <div className="mx-auto w-44 border-t border-ink-3 pt-1">
              <p className="text-[11px] italic text-ink-2">Signature</p>
            </div>
            <p className="mt-1 text-[11px] font-bold text-ink">Director General</p>
            <p className="text-[10px] text-ink-3">Issued on {issuedOn ?? "—"}</p>
          </div>
        </div>

        {/* ── Back ── */}
        <div className="w-[340px] rounded-2xl border border-rule bg-paper shadow-md print:shadow-none overflow-hidden flex flex-col">
          <div className="px-5 pt-5">
            <h2 className="text-center text-sm font-bold text-ink">Instructions</h2>
            <div className="mt-1 h-0.5 w-full bg-primary/70 rounded-full" />
          </div>

          <ul className="px-5 py-4 space-y-2.5">
            {INSTRUCTIONS.map((line, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-snug text-ink-2">
                <span className="mt-0.5 shrink-0 text-primary">▸</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="px-5 pb-5 mt-auto">
            <InfoRow icon={Phone} label="Mobile No" value={mobile} />
            <InfoRow icon={PhoneCall} label="Emergency Contact No" value={emergency} />
            <InfoRow icon={Calendar} label="Date of Birth" value={record.date_of_birth} />
            <InfoRow icon={Droplet} label="Blood Group" value={record.blood_group} />
          </div>
        </div>
      </div>
    </div>
  );
}
