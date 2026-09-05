"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";
import GovHeader from "@/components/GovHeader";
import { toBengaliDigits } from "@/lib/bengali";
import type { OrgInfo } from "@/lib/types";

/**
 * The office order for a factory inspection, as an official letter (D85).
 *
 * **The screen and the PDF are the same page**, exactly as the salary slip is:
 * the toolbar is `print:hidden`, Puppeteer loads this URL, and there is no
 * second layout to keep in step. A letter that looked one way on screen and
 * another on paper is the kind of drift nobody notices until a factory holds
 * the wrong one.
 *
 * **[ASSUMPTION] The Bengali wording is drafted, not supplied.** It follows the
 * register of the bank advice, which is the only other official letter the
 * system issues, but the CM Wing has not confirmed the text of an inspection
 * order. The facts in it — order number, date, product, company, factory, team
 * — are all real; the sentences around them need a wing officer's eye.
 */

export type OrderData = {
  orderNo: string;
  approvedOn: string;
  approvedBy: { name: string; designation: string | null };
  proposedBy: { name: string; designation: string | null };
  scheduledOn: string;
  note: string | null;
  applicationNo: string | null;
  product: { serial: number | null; nameEn: string; nameBn: string | null } | null;
  subProducts: string[];
  company: { nameEn: string; nameBn: string | null; address: string | null };
  factory: { nameEn: string; nameBn: string | null; district: string | null };
  team: { name: string; designation: string | null; role: string | null }[];
};

export default function OrderDocument({
  org,
  order,
  pdfHref,
}: {
  org: OrgInfo;
  order: OrderData;
  pdfHref: string;
}) {
  const [downloading, setDownloading] = useState(false);

  return (
    <div className="min-h-screen bg-muted px-4 py-8 print:m-0 print:bg-white print:p-0">
      <div className="print:hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
        <a
          href={`/workflow`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All files
        </a>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Printer className="h-4 w-4" strokeWidth={1.8} />
            Print
          </button>
          <a
            href={pdfHref}
            onClick={() => {
              // Chromium takes a second or two to start; without this the
              // button looks dead and gets clicked again.
              setDownloading(true);
              window.setTimeout(() => setDownloading(false), 4000);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Download className="h-4 w-4" strokeWidth={1.8} />
            {downloading ? "Preparing…" : "Download PDF"}
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-4xl border border-rule bg-paper font-bn-serif text-base leading-[1.7] shadow-sm print:border-none print:shadow-none">
        <div className="px-12 py-8 print:px-10 print:py-8">
          <GovHeader org={org} />

          {/* Memo line: number on the left, date on the right, as a Bengali
              government letter carries them. */}
          <div className="mt-6 flex items-start justify-between gap-6 text-[11pt]">
            <div>
              <span className="text-ink-2">স্মারক নং:</span>{" "}
              <span className="font-mono">{order.orderNo}</span>
            </div>
            <div>
              <span className="text-ink-2">তারিখ:</span> {order.approvedOn}
            </div>
          </div>

          <h1 className="mt-6 text-center text-[13pt] font-semibold underline underline-offset-4">
            পরিদর্শন আদেশ
          </h1>

          <p className="mt-5 text-[11.5pt]">
            <span className="text-ink-2">বিষয়:</span>{" "}
            <span className="font-semibold">
              সিএম লাইসেন্স আবেদনের প্রেক্ষিতে কারখানা পরিদর্শন ও নমুনা সংগ্রহ প্রসঙ্গে।
            </span>
          </p>

          <p className="mt-5 text-justify">
            উপর্যুক্ত বিষয়ের প্রেক্ষিতে জানানো যাচ্ছে যে,{" "}
            <strong>{order.company.nameBn ?? order.company.nameEn}</strong>
            {order.company.address ? `, ${order.company.address}` : ""} কর্তৃক দাখিলকৃত
            সিএম লাইসেন্স আবেদন
            {order.applicationNo ? (
              <>
                {" "}
                (আবেদন নং: <span className="font-mono">{order.applicationNo}</span>)
              </>
            ) : null}{" "}
            এর প্রেক্ষিতে{" "}
            <strong>{order.product?.nameBn ?? order.product?.nameEn ?? "—"}</strong>{" "}
            পণ্যের গুণগত মান যাচাইয়ের নিমিত্তে{" "}
            <strong>{order.factory.nameBn ?? order.factory.nameEn}</strong>
            {order.factory.district ? `, ${order.factory.district}` : ""} এ অবস্থিত
            কারখানা আগামী <strong>{order.scheduledOn}</strong> তারিখে পরিদর্শন ও
            প্রয়োজনীয় নমুনা সংগ্রহের জন্য নিম্নবর্ণিত কর্মকর্তাবৃন্দকে নিয়ে গঠিত টিমকে
            দায়িত্ব প্রদান করা হলো।
          </p>

          {order.subProducts.length > 0 && (
            <p className="mt-3 text-justify text-[11pt] text-ink-2">
              সংশ্লিষ্ট উপ-পণ্য: {order.subProducts.join("; ")}।
            </p>
          )}

          <table className="mt-5 w-full border-collapse text-[11pt]">
            <thead>
              <tr className="border-y border-rule bg-rule/20">
                <th className="w-12 px-2 py-1.5 text-left font-semibold">ক্রম</th>
                <th className="px-2 py-1.5 text-left font-semibold">নাম</th>
                <th className="px-2 py-1.5 text-left font-semibold">পদবি</th>
                <th className="px-2 py-1.5 text-left font-semibold">দায়িত্ব</th>
              </tr>
            </thead>
            <tbody>
              {order.team.map((m, i) => (
                <tr key={`${m.name}-${i}`} className="border-b border-rule">
                  <td className="px-2 py-1.5">{toBengaliDigits(i + 1)}</td>
                  <td className="px-2 py-1.5">{m.name}</td>
                  <td className="px-2 py-1.5">{m.designation ?? "—"}</td>
                  <td className="px-2 py-1.5">{m.role ?? "টিম সদস্য"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {order.note && (
            <p className="mt-4 text-justify text-[11pt]">
              <span className="text-ink-2">বিশেষ নির্দেশনা:</span> {order.note}
            </p>
          )}

          <p className="mt-4 text-justify">
            পরিদর্শনকালে সংগৃহীত নমুনা যথাযথভাবে সিলগালা করে সংশ্লিষ্ট পরীক্ষাগারে
            প্রেরণের ব্যবস্থা গ্রহণের জন্য অনুরোধ করা হলো। পরিদর্শন শেষে নির্ধারিত
            প্রতিবেদন দাখিল করতে হবে।
          </p>

          {/* Signature block: the approver signs, because approval is what
              issues the order (D82). */}
          <div className="mt-14 flex justify-end">
            <div className="text-center">
              <div className="h-10" />
              <div className="border-t border-ink pt-1 text-[11pt]">
                <div className="font-semibold">{order.approvedBy.name}</div>
                <div className="text-ink-2">{order.approvedBy.designation ?? ""}</div>
                {org.office_bn && <div className="text-ink-2">{org.office_bn}</div>}
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-rule pt-3 text-[10pt] text-ink-3">
            পরিদর্শন পরিকল্পনা প্রস্তাব করেছেন: {order.proposedBy.name}
            {order.proposedBy.designation ? `, ${order.proposedBy.designation}` : ""}।
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            margin: 1.5cm 2cm;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
}
