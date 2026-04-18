import type { EmployeeRecord } from "@/lib/types";
import SectionHead from "./SectionHead";
import DataTable, { Cell, Mono, Muted, SLCell } from "./DataTable";

type Props = {
  rows: EmployeeRecord["foreign_trainings"];
};

export default function ForeignTrainingSection({ rows }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead number="08" title="Foreign Training" tag="Abroad" />
      <DataTable
        columns={[
          { header: "SL", width: "26px" },
          { header: "Course Name" },
          { header: "Country", width: "14%" },
          { header: "Institution", width: "22%" },
          { header: "Duration", width: "18%" },
        ]}
      >
        {rows.map((row) => (
          <tr key={row.sl} className="ruled-row">
            <SLCell sl={row.sl} />
            <Cell>
              <strong className="font-semibold">{row.course_name}</strong>
              {row.course_subtitle ? <Muted>{row.course_subtitle}</Muted> : null}
            </Cell>
            <Cell>{row.country}</Cell>
            <Cell>{row.institution}</Cell>
            <Cell>
              <Mono className="text-ink">{row.duration}</Mono>
            </Cell>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
