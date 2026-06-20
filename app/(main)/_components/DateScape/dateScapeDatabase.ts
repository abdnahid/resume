import type { ICalendarSettings } from "./dateScapeTypes";

export const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const _m = new Date().getMonth();
const _y = new Date().getFullYear();
export const defaultCalendarSettings: ICalendarSettings = {
  month: _m,
  year: _y,
  arrowButtonStyle:
    "rounded-md shadow-md p-1 dark:text-white bg-card hover:scale-115 cursor-pointer transition-all duration-500",
};
