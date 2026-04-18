import type { EmployeeRecord } from "@/lib/types";
import SectionHead from "./SectionHead";
import DataTable, { Cell, Mono, Muted, SLCell } from "./DataTable";

type Props = {
  rows: EmployeeRecord["promotions"];
};

export default function PromotionSection({ rows }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead number="06" title="Promotion Information" tag="Advancement" />
      <DataTable
        columns={[
          { header: "SL", width: "26px" },
          { header: "Promoted Designation", width: "32%" },
          { header: "Joining Date", width: "18%" },
          { header: "Order No. & Date" },
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
            <Cell>
              <span className="font-mono text-[9pt] tracking-[0.02em]">
                {row.joining_date}
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
