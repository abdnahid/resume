import { CheckCircle2, FileText, PackageCheck } from "lucide-react";

/**
 * The sealed boxes the applicant is holding, and where each one goes (D98).
 *
 * Placed with the shortfall notice above the form rather than in the sidebar,
 * because it is the same kind of thing: **the file is waiting on the
 * applicant**, and there is no notification channel — no mail, no SMS (client
 * addresses are often `@mobile.bsti.invalid` placeholders) — so this panel is
 * the notice.
 *
 * It repeats what the letter says instead of only linking to it. The letter is
 * the document they carry; this is the answer to "what do I do now", and
 * putting that behind a click assumes they know to click.
 */
export default function SampleLetterNotice({
  applicationId,
  letterNo,
  issuedOn,
  dueOn,
  boxes,
}: {
  applicationId: number;
  letterNo: string;
  issuedOn: string;
  dueOn: string;
  boxes: {
    code: string;
    sealNo: string;
    labName: string;
    officeName: string;
    specimenCount: number;
    submittedOn: string | null;
  }[];
}) {
  const outstanding = boxes.filter((b) => !b.submittedOn);
  const done = boxes.length - outstanding.length;

  return (
    <section className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
            <PackageCheck className="h-4 w-4 text-primary" strokeWidth={2} />
            {outstanding.length > 0
              ? "Sealed samples to deliver"
              : "All sealed samples delivered"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Letter <span className="font-mono">{letterNo}</span>, issued {issuedOn}.
            {outstanding.length > 0 && (
              <> Please deliver by <span className="font-medium text-foreground">{dueOn}</span>.</>
            )}
          </p>
        </div>
        <a
          href={`/public/applications/${applicationId}/letter`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
          Open the letter
        </a>
      </div>

      {outstanding.length > 0 && (
        <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-foreground">
          Carry each box to the One Stop Service Centre named beside it, with the
          seal <span className="font-semibold">unbroken</span>. A box whose seal is
          broken or damaged will not be accepted and the samples will have to be
          collected again.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {boxes.map((b) => (
          <li
            key={b.code}
            className="rounded-xl border border-border bg-card p-3 text-sm sm:flex sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                One Stop Service Centre, {b.officeName}
              </p>
              <p className="text-xs text-muted-foreground">
                {b.labName} · {b.specimenCount} sample{b.specimenCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {b.code} · seal {b.sealNo}
              </p>
            </div>
            <div className="mt-2 shrink-0 sm:mt-0">
              {b.submittedOn ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Received {b.submittedOn}
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Not yet delivered
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {done > 0 && outstanding.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {done} of {boxes.length} delivered.
        </p>
      )}
    </section>
  );
}
