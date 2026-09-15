"use client";

import { Printer } from "lucide-react";

/**
 * A sheet of specimen labels, cut and stuck on the jars.
 *
 * Each carries the **printed** identifier and nothing else that could be worked
 * back to a party: the sub-product, the article and the specimen number, which
 * the examiner needs, and the brand — which he must never see — is deliberately
 * absent. The variant *is* the applicant's identity (D71), so only the size and
 * the specimen number distinguish two jars on the bench.
 */
export default function LabelSheet({
  applicationNo,
  productName,
  labels,
}: {
  applicationNo: string | null;
  productName: string | null;
  labels: {
    ref: string;
    specimenNo: number;
    subProductName: string;
    size: string;
    boxCode: string;
    labName: string;
    qr: string;
  }[];
}) {
  return (
    <div className="min-h-screen bg-muted px-4 py-8 print:m-0 print:bg-white print:p-0">
      <div className="print:hidden mx-auto mb-4 flex max-w-5xl items-center justify-between gap-3">
        <a href="/workflow" className="text-sm text-muted-foreground hover:text-foreground">
          ← All files
        </a>
        <div className="text-sm text-muted-foreground">
          {labels.length} {labels.length === 1 ? "label" : "labels"} ·{" "}
          {applicationNo ?? ""} {productName ? `· ${productName}` : ""}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Printer className="h-4 w-4" strokeWidth={1.8} />
          Print
        </button>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 print:gap-2">
        {labels.map((l) => (
          <div
            key={l.ref}
            className="break-inside-avoid rounded-lg border border-dashed border-ink/40 bg-paper p-3 print:border-solid"
          >
            <div className="flex gap-2">
              <div
                className="h-20 w-20 shrink-0 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: l.qr }}
              />
              <div className="min-w-0 text-[9pt] leading-tight">
                <p className="font-semibold text-ink">BSTI · specimen</p>
                <p className="mt-0.5 break-all font-mono text-[8pt] text-ink-2">{l.ref}</p>
                <p className="mt-1 text-ink">
                  {l.subProductName.length > 34
                    ? `${l.subProductName.slice(0, 34)}…`
                    : l.subProductName}
                </p>
                <p className="text-ink-2">
                  {l.size} · no. {l.specimenNo}
                </p>
              </div>
            </div>
            <p className="mt-1.5 border-t border-rule pt-1 text-[8pt] text-ink-3">
              {l.labName} · box <span className="font-mono">{l.boxCode}</span>
            </p>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
}
