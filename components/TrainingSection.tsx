import type { EmployeeRecord } from "@/lib/types";
import SectionHead from "./SectionHead";
import DataTable, { Cell, Mono, Muted, Pill, SLCell } from "./DataTable";

type Props = {
  rows: EmployeeRecord["trainings"];
};

export default function TrainingSection({ rows }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead number="07" title="Training Information" tag="Local" />
      <DataTable
        columns={[
          { header: "SL", width: "26px" },
          { header: "Course Name" },
          { header: "Institution", width: "22%" },
          { header: "Duration", width: "20%" },
          { header: "Result", width: "16%" },
        ]}
      >
        {rows.map((row) => (
          <tr key={row.sl} className="ruled-row">
            <SLCell sl={row.sl} />
            <Cell>
              <strong className="font-semibold">{row.course_name}</strong>
              {row.course_subtitle ? <Muted>{row.course_subtitle}</Muted> : null}
            </Cell>
            <Cell>{row.institution}</Cell>
            <Cell>
              <Mono className="text-ink">{row.duration}</Mono>
            </Cell>
            <Cell>
              <Pill variant="ok">{row.result}</Pill>
            </Cell>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
