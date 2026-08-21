"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import GovHeader from "@/components/GovHeader";
import { toBengaliDigits } from "@/lib/bengali";
import type { IdCardBatchDetail, OrgInfo } from "@/lib/types";

export default function AuthorizationListDocument({
  batch,
  org,
}: {
  batch: IdCardBatchDetail;
  org: OrgInfo;
}) {
  const router = useRouter();
  const count = batch.cards.length;

  return (
    <div className="min-h-screen bg-muted py-8 px-4 print:bg-white print:p-0 print:min-h-0">
      {/* Toolbar */}
      <div className="print:hidden max-w-4xl mx-auto flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-title">Authorization List</h1>
            <p className="text-sm text-muted-foreground">
              Batch #{batch.id} · {count} employee{count !== 1 ? "s" : ""}
            </p>
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

      {/* Document */}
      <div className="max-w-4xl mx-auto bg-paper shadow-sm border border-rule print:shadow-none print:border-none font-bn-serif text-ink">
        <div className="px-12 py-8 print:px-10 print:py-8">
          <GovHeader org={org} />

          {/* Memo + date */}
          <div className="flex justify-between items-start mt-4 mb-3 text-ink-2">
            <p>
              <span className="font-semibold">স্মারক নংঃ</span>{" "}
              {batch.memoNo || "—"}
            </p>
            <p>
              <span className="font-semibold">তারিখঃ</span>{" "}
              {toBengaliDigits(batch.requestedAt)}
            </p>
          </div>

          {/* Title */}
          <h2 className="text-center text-[14pt] font-bold underline underline-offset-4 my-4">
            পরিচয়পত্র (আইডি কার্ড) প্রত্যয়নের তালিকা
          </h2>

          {/* Subject / intro */}
          <p className="text-ink-2 leading-[1.9] mb-4 text-justify">
            নিম্নবর্ণিত{" "}
            <span className="font-semibold">{toBengaliDigits(String(count))} জন</span>{" "}
            কর্মকর্তা/কর্মচারীর পরিচয়পত্র (আইডি কার্ড) ইস্যুর নিমিত্তে মাননীয় মহাপরিচালক মহোদয়ের
            সদয় অনুমোদন ও স্বাক্ষরের জন্য তালিকাটি উপস্থাপন করা হলো।
          </p>

          {/* Table */}
          <table className="w-full border-collapse text-[11pt]">
            <thead>
              <tr className="bg-secondary/60">
                <th className="border border-rule-strong px-2 py-1.5 text-center w-12">ক্রমিক</th>
                <th className="border border-rule-strong px-2 py-1.5 text-left w-32">আইডি নং</th>
                <th className="border border-rule-strong px-2 py-1.5 text-left">নাম</th>
                <th className="border border-rule-strong px-2 py-1.5 text-left">পদবি</th>
                <th className="border border-rule-strong px-2 py-1.5 text-left">কর্মস্থল</th>
              </tr>
            </thead>
            <tbody>
              {batch.cards.map((c, i) => (
                <tr key={c.id} className="align-top">
                  <td className="border border-rule px-2 py-1.5 text-center">
                    {toBengaliDigits(String(i + 1))}
                  </td>
                  <td className="border border-rule px-2 py-1.5 font-mono text-[10pt]">{c.employee.id}</td>
                  <td className="border border-rule px-2 py-1.5">{c.employee.name.bn}</td>
                  <td className="border border-rule px-2 py-1.5">{c.employee.designation_bn || "—"}</td>
                  <td className="border border-rule px-2 py-1.5">{c.employee.office_bn || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signature block */}
          <div className="mt-16 flex justify-end">
            <div className="text-center">
              <div className="w-56 border-t border-ink-2 pt-1">
                <p className="font-semibold">{batch.dgName.bn}</p>
                <p className="text-ink-2">মহাপরিচালক</p>
                <p className="text-ink-3 text-[10pt]">বাংলাদেশ স্ট্যান্ডার্ডস অ্যান্ড টেস্টিং ইনস্টিটিউশন</p>
                {batch.signedDate && (
                  <p className="text-ink-3 text-[10pt] mt-1">
                    স্বাক্ষরের তারিখঃ {toBengaliDigits(batch.signedDate)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
