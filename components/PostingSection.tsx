import type { EmployeeRecord } from "@/lib/types";
import SectionHead from "./SectionHead";
import DataTable, { Cell, Mono, Muted, SLCell } from "./DataTable";

type Props = {
  rows: EmployeeRecord["postings"];
};

export default function PostingSection({ rows }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead number="05" title="Posting Information" tag="Service record" />
      <DataTable
        columns={[
          { header: "SL", width: "26px" },
          { header: "Designation", width: "22%" },
          { header: "Office" },
          { header: "Tenure", width: "22%" },
          { header: "Order No. & Date", width: "26%" },
        ]}
      >
        {rows.map((row) => (
          <tr key={row.sl} className="ruled-row">
            <SLCell sl={row.sl} />
            <Cell className="font-bn">
              <strong className="font-semibold">{row.designation_bn}</strong>
              <span className="ml-1 text-[8.5pt] text-ink-3">
                · {row.designation_en}
              </span>
            </Cell>
            <Cell>{row.office}</Cell>
            <Cell>
              <span className="font-mono text-[8pt] tracking-[0.02em] text-ink">
                <span>{row.start}</span>
                <span className="mx-1 text-accent">→</span>
                <span>{row.end}</span>
              </span>
            </Cell>
            <Cell>
              <Mono className="text-ink">{row.order_no}</Mono>
              <Muted>{row.order_date}</Muted>
            </Cell>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
