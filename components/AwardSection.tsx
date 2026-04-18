import type { EmployeeRecord } from "@/lib/types";
import SectionHead from "./SectionHead";
import DataTable, { Cell, SLCell } from "./DataTable";

type Props = {
  rows: EmployeeRecord["awards"];
};

export default function AwardSection({ rows }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead number="10" title="Awards & Recognition" tag="Honors" />
      <DataTable
        columns={[
          { header: "SL", width: "26px" },
          { header: "Award Title" },
          { header: "Type", width: "22%" },
          { header: "Country", width: "14%" },
          { header: "Org.", width: "12%" },
          { header: "Date", width: "12%" },
        ]}
      >
        {rows.map((row) => (
          <tr key={row.sl} className="ruled-row">
            <SLCell sl={row.sl} />
            <Cell>
              <strong className="font-semibold">{row.title}</strong>
            </Cell>
            <Cell>{row.type}</Cell>
            <Cell>{row.country}</Cell>
            <Cell>{row.org}</Cell>
            <Cell>
              <span className="font-mono text-[9pt] tracking-[0.02em]">
                {row.date}
              </span>
            </Cell>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
