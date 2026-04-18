import type { EmployeeRecord } from "@/lib/types";
import SectionHead from "./SectionHead";
import DataTable, { Cell, Mono, Pill, SLCell } from "./DataTable";

type Props = {
  rows: EmployeeRecord["education"];
};

export default function EducationSection({ rows }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead number="04" title="Educational Information" tag="Verified" />
      <DataTable
        columns={[
          { header: "SL", width: "26px" },
          { header: "Degree", width: "12%" },
          { header: "Board / University" },
          { header: "Subject", width: "25%" },
          { header: "Year", width: "8%" },
          { header: "Result", width: "20%" },
        ]}
      >
        {rows.map((row) => (
          <tr key={row.sl} className="ruled-row">
            <SLCell sl={row.sl} />
            <Cell className={row.is_bn ? "font-bn" : ""}>
              <strong className="font-semibold text-ink">
                {row.degree_primary}
              </strong>
              {row.degree_secondary ? (
                <span className="ml-1 text-[8.5pt] text-ink-3">
                  · {row.degree_secondary}
                </span>
              ) : null}
            </Cell>
            <Cell>{row.institution}</Cell>
            <Cell>{row.subject}</Cell>
            <Cell>
              <Mono>{row.year}</Mono>
            </Cell>
            <Cell>
              {row.result} {row.scale !== null ? `(out of ${row.scale})` : ""}
            </Cell>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
