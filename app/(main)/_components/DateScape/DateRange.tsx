// "use client";
// import { useState } from "react";
// import * as classes from "@/app/(main)/_components/tailwindClasses";
// import {
//   ArrowDoubleLeftIcon,
//   ArrowDoubleRightIcon,
//   ArrowLeftIcon,
//   ArrowRightIcon,
//   CrossIcon,
// } from "@/assets/Icons/icons";
// import { AnimatePresence, motion } from "framer-motion";
// import { ICalendarSettings } from "./dateScapeTypes";
// import { delay, generateBnDate } from "@/utils/generators";
// import { TLangDateFormat } from "@/typescript/types";
// import { getSortedDays } from "./dateScapeFunctions";
// import { dayNames, monthNames } from "./dateScapeDatabase";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";

// const currentMonth = new Date().getMonth();
// const currentYear = new Date().getFullYear();
// const defaultSettings: ICalendarSettings = {
//   month: currentMonth,
//   year: currentYear,
//   arrowButtonStyle:
//     "rounded-full text-xl shadow-md p-2 dark:text-white hover:bg-theme-dark hover:text-white dark:hover:text-white transition-all duration-500",
// };
// const DateRange = ({
//   calendarSettings = defaultSettings,
//   name,
//   startDate,
//   endDate,
//   getStartDate,
//   getEndDate,
//   buttonClasses,
//   lang = "bn-BD",
//   isRequired = false,
// }: {
//   calendarSettings?: ICalendarSettings;
//   name: string;
//   startDate?: Date;
//   endDate?: Date;
//   isRequired?: boolean;
//   buttonClasses?: string;
//   lang?: TLangDateFormat;
//   getStartDate: (date?: Date) => void;
//   getEndDate: (date?: Date) => void;
// }) => {
//   const [open, setOpen] = useState<boolean>(false);

//   const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>(
//     startDate
//   );
//   const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(
//     endDate
//   );
//   const [hoverEndDay, setHoverEndDay] = useState<number | undefined>(undefined);

//   const { month, year, arrowButtonStyle } = calendarSettings;
//   const [annualYear, setAnnualYear] = useState(year);
//   const [period, setPeriod] = useState(month);
//   const arrayOfDate: Date[] = getSortedDays(annualYear, period);
//   let dateRangeValue: string = "";
//   if (selectedStartDate) {
//     if (selectedEndDate) {
//       dateRangeValue =
//         generateBnDate(selectedStartDate, lang) +
//         " to " +
//         generateBnDate(selectedEndDate, lang);
//     } else {
//       generateBnDate(selectedStartDate, lang) + " to dd-mm-yyyy";
//     }
//   }
//   return (
//     <div className="relative w-full">
//       <Input
//       id={name}
//       />
//       <input
//         id={name}
//         className={classes.inputClasses}
//         onChange={(e) => {
//           console.log("selectedStartDate");
//         }}
//         onFocus={() => setOpen(true)}
//         type="text"
//         autoComplete="off"
//         placeholder="dd-mm-yyyy to dd-mm-yyyy"
//         required={isRequired}
//         value={
//           selectedStartDate && selectedEndDate
//             ? generateBnDate(selectedStartDate, lang) +
//               " to " +
//               generateBnDate(selectedEndDate, lang)
//             : selectedStartDate && !selectedEndDate
//             ? generateBnDate(selectedStartDate, lang) + " to dd-mm-yyyy"
//             : ""
//         }
//       />
//       <Label htmlFor={name}>
// {name}
//       </Label>
//       {selectedStartDate && selectedEndDate && (
//         <button
//           className="z-30 cursor-pointer absolute -translate-y-1/2 right-2 top-1/2 rounded-full p-2 bg-white ring-1 dark:ring-0 ring-red-200 dark:bg-theme-dark text-xl text-red-200 hover:shadow-[0_0_12px_rgba(252,165,165,1)] duration-500 transition-all"
//           type="button"
//           onClick={() => {
//             setSelectedStartDate(undefined);
//             setSelectedEndDate(undefined);
//             getStartDate(undefined);
//             getEndDate(undefined);
//           }}
//         >
//           <CrossIcon />
//         </button>
//       )}
//       <AnimatePresence>
//         {open && (
//           <motion.div
//             initial={{ opacity: 0, scale: 0 }}
//             animate={{ opacity: 1, scale: 1 }}
//             exit={{ opacity: 0, scale: 0 }}
//             transition={{
//               type: "tween",
//               duration: 0.3,
//             }}
//             className="w-full rounded-md shadow-md p-5 bg-bodyBg dark:bg-cardBg-darkAlt absolute top-[50px] left-0 z-[60]"
//           >
//             <div className="relative h-6">
//               <span
//                 className="absolute top-0 right-0 text-2xl text-theme-75 dark:text-red-200 cursor-pointer"
//                 onClick={() => setOpen(false)}
//               >
//                 {CrossIcon()}
//               </span>
//             </div>
//             <div className="flex items-center border-b-2 border-theme-dark py-5 mb-5">
//               <div className="flex gap-2">
//                 <button
//                   type="button"
//                   className={arrowButtonStyle}
//                   name="yearLeft"
//                   onClick={() => setAnnualYear((prev) => prev - 1)}
//                 >
//                   {ArrowDoubleLeftIcon()}
//                 </button>
//                 <button
//                   type="button"
//                   className={arrowButtonStyle}
//                   name="monthLeft"
//                   onClick={() => {
//                     if (period === 0) {
//                       setPeriod(11);
//                       setAnnualYear((prev) => prev - 1);
//                     } else {
//                       setPeriod((prev) => prev - 1);
//                     }
//                   }}
//                 >
//                   {ArrowLeftIcon()}
//                 </button>
//               </div>
//               <div className="grow text-center font-bold text-base dark:text-white">
//                 {monthNames[period]} , {annualYear}
//               </div>
//               <div className="flex gap-2">
//                 <button
//                   type="button"
//                   className={arrowButtonStyle}
//                   name="monthRight"
//                   onClick={() => {
//                     if (period === 11) {
//                       setPeriod(0);
//                       setAnnualYear((prev) => prev + 1);
//                     } else {
//                       setPeriod((prev) => prev + 1);
//                     }
//                   }}
//                 >
//                   {ArrowRightIcon()}
//                 </button>
//                 <button
//                   type="button"
//                   className={arrowButtonStyle}
//                   name="yearRight"
//                   onClick={() => setAnnualYear((prev) => prev + 1)}
//                 >
//                   {ArrowDoubleRightIcon()}
//                 </button>
//               </div>
//             </div>
//             <div className={`grid grid-cols-7 place-items-center`}>
//               {dayNames.map((item, index) => (
//                 <span
//                   key={index}
//                   className="font-semibold text-theme-dark dark:text-white opacity-75 mb-3 text-sm"
//                 >
//                   {item}
//                 </span>
//               ))}
//               {arrayOfDate.map((date, index) => {
//                 const today = new Date().getDate();
//                 const itemMonth = date.getMonth();
//                 const statusCheck = itemMonth !== period;
//                 const selectedStartDateTime: number | undefined =
//                   startDate && startDate.getTime();
//                 const selectedEndDateTime: number | undefined =
//                   endDate && endDate.getTime();
//                 const dateTime: number = date.getTime();
//                 return (
//                   <div
//                     key={index}
//                     className={`w-full ${
//                       selectedStartDateTime &&
//                       selectedEndDateTime &&
//                       dateTime > selectedStartDateTime &&
//                       dateTime < selectedEndDateTime
//                         ? `bg-slate-200 dark:bg-slate-600`
//                         : selectedStartDateTime &&
//                           !selectedEndDate &&
//                           dateTime > selectedStartDateTime &&
//                           dateTime < (hoverEndDay as number)
//                         ? `bg-slate-200 dark:bg-slate-600`
//                         : ""
//                     } ${
//                       (hoverEndDay &&
//                         hoverEndDay !== selectedStartDateTime &&
//                         selectedStartDateTime === dateTime) ||
//                       (selectedStartDateTime &&
//                         selectedEndDateTime &&
//                         selectedStartDateTime !== selectedEndDateTime &&
//                         selectedStartDate === date)
//                         ? `bg-gradient-to-r from-white to-slate-200 dark:from-cardBg-darkAlt dark:to-slate-600`
//                         : ""
//                     } ${
//                       (hoverEndDay &&
//                         hoverEndDay !== selectedStartDateTime &&
//                         hoverEndDay === dateTime) ||
//                       (selectedStartDate &&
//                         selectedEndDate &&
//                         selectedStartDate !== selectedEndDate &&
//                         selectedEndDate === date)
//                         ? `bg-gradient-to-l from-white to-slate-200 dark:from-cardBg-darkAlt dark:to-slate-600`
//                         : ""
//                     }`}
//                   >
//                     <button
//                       type="button"
//                       value={date.toDateString()}
//                       disabled={
//                         selectedStartDateTime && !selectedEndDate
//                           ? dateTime < selectedStartDateTime
//                           : false
//                       }
//                       className={`${
//                         statusCheck
//                           ? " text-gray-500"
//                           : "text-black dark:text-white"
//                       } ${
//                         dateTime === selectedStartDateTime ||
//                         dateTime === selectedEndDateTime
//                           ? "bg-theme"
//                           : ""
//                       }
//                            w-full hover:bg-theme hover:text-white transition-all duration-300 font-semibold p-2 text-center text-sm ${buttonClasses} ${
//                         selectedStartDateTime &&
//                         !selectedEndDate &&
//                         dateTime < selectedStartDateTime
//                           ? "cursor-not-allowed"
//                           : "cursor-pointer"
//                       }`}
//                       onMouseEnter={() => {
//                         if (selectedStartDate && !selectedEndDate) {
//                           setHoverEndDay(date.getTime());
//                         } else if (selectedStartDate && selectedEndDate) {
//                           setHoverEndDay(undefined);
//                         }
//                       }}
//                       onClick={async (e: any) => {
//                         if (selectedStartDate && selectedEndDate) {
//                           setSelectedStartDate(e.target.value);
//                           setSelectedEndDate(undefined);
//                           getStartDate(e.target.value);
//                         } else if (selectedStartDate) {
//                           setSelectedEndDate(e.target.value);
//                           setHoverEndDay(undefined);
//                           getEndDate(e.target.value);
//                           await delay(100);
//                           setOpen(false);
//                         } else {
//                           setSelectedStartDate(e.target.value);
//                           setSelectedEndDate(undefined);
//                           getStartDate(e.target.value);
//                         }
//                       }}
//                     >
//                       {date.getDate()}
//                     </button>
//                   </div>
//                 );
//               })}
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// };
// export default DateRange;
