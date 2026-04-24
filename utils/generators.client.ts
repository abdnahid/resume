import { TLangDateFormat } from "@/lib/typescript/types";

export function generateDate(date: Date, lang: TLangDateFormat): string {
  return date.toLocaleDateString(lang, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
