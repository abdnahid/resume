"use client";
import { useState } from "react";
import { ICalendarSettings } from "./dateScapeTypes";
import { dayNames, monthNames } from "./dateScapeDatabase";
import { CalendarHeader } from "./CalendarHeader";
import { getSortedDays } from "./dateScapeFunctions";
import { TLangDateFormat } from "@/lib/typescript/types";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FakeInput } from "../FakeInput";
import { generateDate } from "@/utils/generators.client";

const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();
const defaultSettings: ICalendarSettings = {
  month: currentMonth,
  year: currentYear,
  arrowButtonStyle:
    "rounded-full text-xl shadow-md p-2 dark:text-white bg-bodyBg dark:bg-bodyBg-dark hover:bg-theme-dark hover:text-white cursor-pointer dark:hover:text-white transition-all duration-500",
};
const SingleDatePopover = ({
  calendarSettings = defaultSettings,
  fieldTitle,
  defaultDate,
  getSelectedDate,
  lang = "es-CL",
}: {
  calendarSettings?: ICalendarSettings;
  fieldTitle?: string;
  defaultDate?: Date;
  isRequired?: boolean;
  lang?: TLangDateFormat;
  getSelectedDate: (date?: Date) => void;
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    defaultDate
  );

  const { month, year, arrowButtonStyle } = calendarSettings;
  const [annualYear, setAnnualYear] = useState<number>(year);
  const [period, setPeriod] = useState(month);
  const arrayOfDate: Date[] = getSortedDays(annualYear, period);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="space-y-2">
        <FakeInput
          value={selectedDate ? generateDate(selectedDate, lang) : undefined}
          onClear={() => setSelectedDate(undefined)}
          fieldTitle={fieldTitle}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] bg-popover"
        align="start"
      >
        <CalendarHeader
          period={period}
          annualYear={annualYear}
          setPeriod={setPeriod}
          setAnnualYear={setAnnualYear}
        />
        <div className="flex items-center justify-between border-b-2 border-theme py-2 mb-5">
          <div className="flex gap-2">
            <button
              type="button"
              className={arrowButtonStyle}
              name="yearLeft"
              onClick={() => setAnnualYear((prev) => prev - 1)}
            >
              <ChevronsLeft />
            </button>
            <button
              type="button"
              className={arrowButtonStyle}
              name="monthLeft"
              onClick={() => {
                if (period === 0) {
                  setPeriod(11);
                  setAnnualYear((prev) => prev - 1);
                } else {
                  setPeriod((prev) => prev - 1);
                }
              }}
            >
              <ChevronLeft />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={arrowButtonStyle}
              name="monthRight"
              onClick={() => {
                if (period === 11) {
                  setPeriod(0);
                  setAnnualYear((prev) => prev + 1);
                } else {
                  setPeriod((prev) => prev + 1);
                }
              }}
            >
              <ChevronRight />
            </button>
            <button
              type="button"
              className={arrowButtonStyle}
              name="yearRight"
              onClick={() => setAnnualYear((prev) => prev + 1)}
            >
              <ChevronsRight />
            </button>
          </div>
        </div>
        <div className={`grid grid-cols-7 place-items-center gap-1`}>
          {dayNames.map((item, index) => (
            <span
              key={index}
              className="font-semibold text-theme-dark dark:text-white opacity-75 mb-3 text-sm"
            >
              {item}
            </span>
          ))}
          {arrayOfDate.map((date, index) => {
            const today = new Date();
            const itemMonth = date.getMonth();
            const statusCheck = itemMonth !== period;
            return (
              <button
                type="button"
                value={date.toDateString()}
                key={index}
                className={`${
                  statusCheck
                    ? " text-gray-500"
                    : date === selectedDate
                    ? "bg-theme text-white"
                    : "text-black dark:text-white"
                } w-full rounded-full hover:bg-theme-dark hover:text-white transition-all duration-300 cursor-pointer font-semibold p-2 text-center text-sm`}
                onClick={(e: any) => {
                  const clickedDate = new Date(e.target.value);
                  setSelectedDate(clickedDate);
                  getSelectedDate(clickedDate);
                  setOpen(false);
                }}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
export default SingleDatePopover;
