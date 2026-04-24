import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TLangDateFormat } from "@/lib/typescript/types";
import { useState } from "react";
import { ICalendarSettings } from "./dateScapeTypes";
import { getSortedDays } from "./dateScapeFunctions";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { dayNames, monthNames } from "./dateScapeDatabase";
import { CalendarHeader } from "./CalendarHeader";
import { FakeInput } from "../FakeInput";
import { delay, generateDate } from "@/utils/generators.client";

const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();
const defaultSettings: ICalendarSettings = {
  month: currentMonth,
  year: currentYear,
  arrowButtonStyle:
    "rounded-md shadow-md p-1 dark:text-white bg-card hover:scale-115 cursor-pointer transition-all duration-500",
};

export function DateRangePopover({
  calendarSettings = defaultSettings,
  name,
  startDate,
  endDate,
  getStartDate,
  width,
  getEndDate,
  lang = "bn-BD",
  arrowSize,
  buttonClasses,
  fieldTitle,
}: {
  calendarSettings?: ICalendarSettings;
  name: string;
  startDate?: Date;
  endDate?: Date;
  width?: string;
  arrowSize?: number;
  isRequired?: boolean;
  lang?: TLangDateFormat;
  buttonClasses?: string;
  getStartDate: (date?: string) => void;
  getEndDate: (date?: string) => void;
  fieldTitle?: string;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [hoverEndDay, setHoverEndDay] = useState<number | undefined>(undefined);

  const { month, year, arrowButtonStyle } = calendarSettings;
  const [annualYear, setAnnualYear] = useState(year);
  const [period, setPeriod] = useState(month);
  const arrayOfDate: Date[] = getSortedDays(annualYear, period);
  let dateRangeValue: string = "";
  if (startDate) {
    if (endDate) {
      dateRangeValue =
        generateDate(startDate, lang) + " to " + generateDate(endDate, lang);
    } else {
      generateDate(startDate, lang) + " to dd-mm-yyyy";
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={`space-y-2 ${width || "w-full"}`}>
        <FakeInput
          value={dateRangeValue}
          onClear={() => {
            getStartDate(undefined);
            getEndDate(undefined);
          }}
          fieldTitle={fieldTitle}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] bg-popover"
        align="start"
      >
        <div className="w-full flex items-center justify-center gap-2">
          <CalendarRange size={16} className="text-primary shrink-0" />
          <CalendarHeader
            period={period}
            annualYear={annualYear}
            setPeriod={setPeriod}
            setAnnualYear={setAnnualYear}
          />
        </div>
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
        <div className={`grid grid-cols-7 gap-0.5 place-items-center`}>
          {dayNames.map((item, index) => (
            <div
              key={index}
              className="font-semibold text-center text-theme-dark border-b border-primary/60 dark:text-white opacity-75 text-sm w-full p-1"
            >
              {item}
            </div>
          ))}
          {arrayOfDate.map((date, index) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isToday = today.getTime() === date.getTime();
            const itemMonth = date.getMonth();
            const statusCheck = itemMonth !== period;
            const selectedStartDateTime = startDate
              ? new Date(startDate).getTime()
              : 0;
            const selectedEndDateTime = endDate
              ? new Date(endDate).getTime()
              : 0;
            const dateTime: number = date.getTime();

            return (
              <div
                key={index}
                className={`w-full ${
                  startDate &&
                  endDate &&
                  dateTime > selectedStartDateTime &&
                  dateTime < selectedEndDateTime
                    ? `bg-primary/10`
                    : startDate &&
                      !endDate &&
                      dateTime > selectedStartDateTime &&
                      dateTime < (hoverEndDay as number)
                    ? `bg-primary/10`
                    : ""
                } `}
              >
                <button
                  type="button"
                  value={date.toJSON()}
                  disabled={
                    startDate && !endDate
                      ? dateTime < selectedStartDateTime
                      : false
                  }
                  className={`rounded-md relative group text-xs ${
                    isToday
                      ? "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary"
                      : ""
                  } ${
                    statusCheck
                      ? " text-gray-500"
                      : "text-black dark:text-white"
                  } ${
                    dateTime === selectedStartDateTime ||
                    dateTime === selectedEndDateTime
                      ? "bg-primary text-primary-foreground dark:text-text"
                      : ""
                  } 
                           w-full hover:bg-primary/30 hover:text-white transition-all duration-300 font-semibold p-2 text-center text-sm ${buttonClasses} ${
                    startDate && !endDate && dateTime < selectedStartDateTime
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  } ${
                    (hoverEndDay &&
                      hoverEndDay !== selectedStartDateTime &&
                      selectedStartDateTime === dateTime) ||
                    (startDate &&
                      endDate &&
                      selectedStartDateTime !== selectedEndDateTime &&
                      selectedStartDateTime === dateTime)
                      ? `!rounded-r-none`
                      : ""
                  }  ${
                    (hoverEndDay &&
                      hoverEndDay !== selectedStartDateTime &&
                      hoverEndDay === dateTime) ||
                    (startDate &&
                      endDate &&
                      selectedStartDateTime !== selectedEndDateTime &&
                      selectedEndDateTime === dateTime)
                      ? `!rounded-l-none`
                      : ""
                  }`}
                  onMouseEnter={() => {
                    if (startDate && !endDate) {
                      setHoverEndDay(date.getTime());
                    } else if (startDate && endDate) {
                      setHoverEndDay(undefined);
                    }
                  }}
                  onClick={async (e: any) => {
                    if (startDate && endDate) {
                      getStartDate(e.target.value);
                    } else if (startDate) {
                      setHoverEndDay(undefined);
                      getEndDate(e.target.value);
                      await delay(100);
                      setOpen(false);
                    } else {
                      getStartDate(e.target.value);
                    }
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
}
