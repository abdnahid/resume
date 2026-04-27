import type { EmployeeRecord } from "@/lib/types";
import SectionHead from "./SectionHead";

type Props = {
  job: EmployeeRecord["current_job"];
};

export default function CurrentJobSection({ job }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead
        number="02"
        title="Current Job Information"
        tag="In service"
      />

      <div className="grid grid-cols-[1.3fr_1fr] border border-rule bg-white">
        <div className="border-r border-rule px-[18px] py-4">
          <p className="m-0 font-bn-serif text-[16pt] font-semibold leading-[1.15]">
            {job.designation_bn}
          </p>
          <p className="m-0 mt-0.5 font-display text-[11pt] italic leading-[1.15] text-ink-3">
            {job.designation_en}
          </p>
          <p className="mt-1.5 font-bn-serif text-[10pt] font-medium leading-[1.4] text-ink-2">
            {job.office_bn}
          </p>
          <p className="mt-1 font-bn text-[9pt] text-ink-3">
            {job.office_address_bn}
          </p>
          <p className="mt-1 font-bn-serif text-[10pt] font-medium leading-[1.4] text-ink-2">
            {job.office_en}
          </p>
          <p className="mt-1 font-bn text-[9pt] text-ink-3">
            {job.office_address_en}
          </p>
          <div className="mt-2.5 flex items-center gap-4 font-mono text-[7.5pt] uppercase tracking-[0.12em] text-ink-3">
            <span className="rounded-full border border-accent px-2 py-0.5 tracking-[0.16em] text-primary">
              {job.grade}
            </span>
            <span>{job.division}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-[18px] gap-y-3 px-[18px] py-4">
          <Field k="Joining Designation" v={job.initial_designation_bn} bn />
          <Field k="Date of Joining" v={job.date_of_joining} mono />
          <Field k="PRL" v={job.post_retirement_leave} mono />
          <Field k="Full Retirement" v={job.full_retirement} mono />
        </div>
      </div>
    </section>
  );
}

function Field({
  k,
  v,
  mono,
  bn,
}: {
  k: string;
  v: string;
  mono?: boolean;
  bn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-px border-l border-rule pl-2.5">
      <div className="font-mono text-[7pt] uppercase tracking-[0.18em] text-ink-3">
        {k}
      </div>
      <div
        className={[
          "text-[10pt] leading-snug text-ink",
          mono ? "font-mono tracking-[0.02em] text-[9pt]" : "font-body",
          bn ? "font-bn" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {v}
      </div>
    </div>
  );
}
