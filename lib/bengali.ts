const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toBengaliDigits(v: number | string): string {
  return String(v).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
}

export const BENGALI_MONTHS: Record<string, string> = {
  January:   "জানুয়ারি",
  February:  "ফেব্রুয়ারি",
  March:     "মার্চ",
  April:     "এপ্রিল",
  May:       "মে",
  June:      "জুন",
  July:      "জুলাই",
  August:    "আগস্ট",
  September: "সেপ্টেম্বর",
  October:   "অক্টোবর",
  November:  "নভেম্বর",
  December:  "ডিসেম্বর",
};

// Unique Bengali words for 0–99
const BN_ONES = [
  "", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়",
  "দশ", "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোলো", "সতেরো", "আঠারো", "উনিশ",
  "বিশ", "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আটাশ", "উনত্রিশ",
  "ত্রিশ", "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাতত্রিশ", "আটত্রিশ", "উনচল্লিশ",
  "চল্লিশ", "একচল্লিশ", "বেয়াল্লিশ", "তেতাল্লিশ", "চৌচল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "উনপঞ্চাশ",
  "পঞ্চাশ", "একান্ন", "বায়ান্ন", "তিপান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপান্ন", "সাতান্ন", "আটান্ন", "উনষাট",
  "ষাট", "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "উনসত্তর",
  "সত্তর", "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "উনআশি",
  "আশি", "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "আটাশি", "উননব্বই",
  "নব্বই", "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই",
];

export function numberToBengaliWords(n: number): string {
  if (n === 0) return "শূন্য";
  let rem = n;
  const parts: string[] = [];
  if (rem >= 10_000_000) {
    parts.push(BN_ONES[Math.floor(rem / 10_000_000)] + " কোটি");
    rem %= 10_000_000;
  }
  if (rem >= 100_000) {
    parts.push(BN_ONES[Math.floor(rem / 100_000)] + " লক্ষ");
    rem %= 100_000;
  }
  if (rem >= 1_000) {
    parts.push(BN_ONES[Math.floor(rem / 1_000)] + " হাজার");
    rem %= 1_000;
  }
  if (rem >= 100) {
    parts.push(BN_ONES[Math.floor(rem / 100)] + " শত");
    rem %= 100;
  }
  if (rem > 0) parts.push(BN_ONES[rem]);
  return parts.join(" ");
}

// #বিএসটিআই/ঢাকা/এপ্রিল/২০২৬
export function generateMemoNo(month: string, year: string): string {
  return `বিএসটিআই/ঢাকা/${BENGALI_MONTHS[month] ?? month}/${toBengaliDigits(year)}`;
}

// 468502 → "৪৬৮,৫০২.০০"
export function formatBDTBengali(n: number): string {
  return toBengaliDigits(n.toLocaleString("en-US")) + ".০০";
}
