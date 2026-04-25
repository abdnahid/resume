"use client";

import { DateRangePopover } from "@/app/(main)/_components/DateScape/DateRangePopover";

export function FilterDateRange({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  width = "w-64",
  name = "date-range-filter",
}: {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartChange: (d: Date | undefined) => void;
  onEndChange: (d: Date | undefined) => void;
  width?: string;
  name?: string;
}) {
  return (
    <DateRangePopover
      name={name}
      startDate={startDate}
      endDate={endDate}
      getStartDate={(d) => onStartChange(d ? new Date(d) : undefined)}
      getEndDate={(d) => onEndChange(d ? new Date(d) : undefined)}
      lang="en-GB"
      width={width}
    />
  );
}
