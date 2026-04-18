import type { EmployeeRecord } from "@/lib/types";
import SectionHead from "./SectionHead";
import DataTable, { Cell, Pill, SLCell } from "./DataTable";

type Props = {
  rows: EmployeeRecord["publications"];
};

export default function PublicationSection({ rows }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead number="09" title="Publications" tag="Scholarly" />
      <DataTable
        columns={[
          { header: "SL", width: "26px" },
          { header: "Type", width: "14%" },
          { header: "Title" },
          { header: "Publisher", width: "26%" },
          { header: "Date", width: "12%" },
        ]}
      >
        {rows.map((row) => (
          <tr key={row.sl} className="ruled-row">
            <SLCell sl={row.sl} />
            <Cell>
              <Pill>{row.type}</Pill>
            </Cell>
            <Cell>
              <strong className="font-semibold">{row.title}</strong>
            </Cell>
            <Cell>{row.publisher}</Cell>
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
