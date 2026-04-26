"use client";

import { useState } from "react";
import { ICalendarSettings } from "./dateScapeTypes";
import { dayNames } from "./dateScapeDatabase";
import { CalendarHeader } from "./CalendarHeader";
import { getSortedDays } from "./dateScapeFunctions";
import { TLangDateFormat } from "@/lib/typescript/types";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
    "rounded-md shadow-md p-1 dark:text-white bg-card hover:scale-115 cursor-pointer transition-all duration-500",
};

const SingleDatePopover = ({
  calendarSettings = defaultSettings,
  fieldTitle,
  placeholder,
  defaultDate,
  getSelectedDate,
  lang = "en-GB",
  arrowSize,
  width,
}: {
  calendarSettings?: ICalendarSettings;
  fieldTitle?: string;
  placeholder?: string;
  defaultDate?: Date;
  isRequired?: boolean;
  lang?: TLangDateFormat;
  arrowSize?: number;
  width?: string;
  getSelectedDate: (date?: Date) => void;
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultDate);

  const { month, year, arrowButtonStyle } = calendarSettings;
  const [annualYear, setAnnualYear] = useState<number>(year);
  const [period, setPeriod] = useState(month);
  const arrayOfDate: Date[] = getSortedDays(annualYear, period);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={`space-y-2 ${width || "w-full"}`}>
        <FakeInput
          value={selectedDate ? generateDate(selectedDate, lang) : undefined}
          onClear={() => {
            setSelectedDate(undefined);
            getSelectedDate(undefined);
          }}
          fieldTitle={fieldTitle}
          placeholder={placeholder}
        />
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] bg-popover"
        align="start"
      >
        {/* Month/year header */}
        <div className="w-full flex items-center justify-center gap-2">
          <CalendarHeader
            period={period}
            annualYear={annualYear}
            setPeriod={setPeriod}
            setAnnualYear={setAnnualYear}
          />
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center justify-between py-3">
          <div className="flex gap-2">
            <button
              type="button"
              className={arrowButtonStyle}
              name="yearLeft"
              onClick={() => setAnnualYear((prev) => prev - 1)}
            >
              <ChevronsLeft size={arrowSize || 20} />
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
              <ChevronLeft size={arrowSize || 20} />
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
              <ChevronRight size={arrowSize || 20} />
            </button>
            <button
              type="button"
              className={arrowButtonStyle}
              name="yearRight"
              onClick={() => setAnnualYear((prev) => prev + 1)}
            >
              <ChevronsRight size={arrowSize || 20} />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5 place-items-center">
          {/* Day names row */}
          {dayNames.map((item, index) => (
            <div
              key={index}
              className="font-semibold text-center text-theme-dark border-b border-primary/60 dark:text-white opacity-75 text-sm w-full p-1"
            >
              {item}
            </div>
          ))}

          {/* Date cells */}
          {arrayOfDate.map((date, index) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isToday = today.getTime() === date.getTime();
            const statusCheck = date.getMonth() !== period;
            const dateTime = date.getTime();
            const selectedTime = selectedDate
              ? new Date(selectedDate).setHours(0, 0, 0, 0)
              : 0;
            const isSelected = dateTime === selectedTime;

            return (
              <div key={index} className="w-full">
                <button
                  type="button"
                  className={`rounded-md relative group text-xs ${
                    isToday
                      ? "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary"
                      : ""
                  } ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : statusCheck
                      ? "text-gray-500"
                      : "text-black dark:text-white"
                  } w-full hover:bg-primary/30 hover:text-white transition-all duration-300 font-semibold p-2 text-center text-sm cursor-pointer`}
                  onClick={() => {
                    setSelectedDate(date);
                    getSelectedDate(date);
                    setOpen(false);
                  }}
                >
                  {isToday && (
                    <div
                      className="bg-slate-300 text-theme font-sans font-semibold absolute p-1.5 text-[10px] bottom-[calc(100%+4px)] left-1/2 rounded-md -translate-x-1/2 hidden group-hover:block
                        after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2
                        after:border-4 after:border-transparent after:border-t-slate-300"
                    >
                      today
                    </div>
                  )}
                  {date.getDate()}
                </button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SingleDatePopover;
