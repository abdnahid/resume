import type { ReactNode } from "react";

type Column = {
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
};

type Props = {
  columns: Column[];
  children: ReactNode;
};

export default function DataTable({ columns, children }: Props) {
  return (
    <table className="w-full border-collapse text-[9.5pt]">
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th
              key={i}
              style={col.width ? { width: col.width } : undefined}
              className={[
                "border-b-[1.5px] border-ink px-2.5 py-1.5 font-mono text-[7pt] font-medium uppercase tracking-[0.2em] text-ink-3",
                col.align === "right"
                  ? "text-right"
                  : col.align === "center"
                  ? "text-center"
                  : "text-left",
              ].join(" ")}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function SLCell({ sl }: { sl: number }) {
  return (
    <td className="w-[26px] border-b border-rule px-2.5 py-2.5 align-top font-mono text-[8pt] tracking-[0.05em] text-ink-4">
      {String(sl).padStart(2, "0")}
    </td>
  );
}

export function Cell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`border-b border-rule px-2.5 py-2.5 align-top leading-[1.4] text-ink ${className}`}
    >
      {children}
    </td>
  );
}

export function Pill({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "ok";
}) {
  return (
    <span
      className={[
        "inline-block rounded-full border px-2 py-px font-mono text-[7.5pt] uppercase tracking-[0.1em]",
        variant === "ok"
          ? "border-accent text-accent"
          : "border-rule-strong text-ink-2",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <div className="text-[8.5pt] text-ink-3">{children}</div>;
}

export function Mono({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono text-[8.5pt] text-ink-2 ${className}`}>
      {children}
    </span>
  );
}
