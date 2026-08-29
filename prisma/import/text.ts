/**
 * Text handling shared by the import.
 *
 * Bengali needs NFC normalisation before anything is compared: "য়" is either
 * U+09DF or U+09AF+U+09BC depending on which system produced the string, and
 * the two look identical while comparing unequal. `prisma/seed-employees.ts`
 * hit this already.
 */

/** NFC, collapsed whitespace, trimmed. */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The HR export writes absent values as the strings "None" and "null" rather
 * than as JSON null, so a plain truthiness check lets them through.
 */
export function val(s: unknown): string {
  const t = norm(s);
  return t === "None" || t === "null" || t === "-" ? "" : t;
}

/** Same, but null rather than "" — for optional columns. */
export function opt(s: unknown): string | null {
  return val(s) || null;
}

/**
 * A folded form for comparing Bengali post names.
 *
 * The sanctioned list and the HR export write the same post differently:
 * "ইউডিসি-কাম-ক্যাশিয়ার" vs "ইউডিসি কাম ক্যাশিয়ার", "গ্যাসম্যান" vs "গ্যাস ম্যান",
 * "লাইব্রেরিয়ান" vs "লাইব্রেরীয়ান", "কারিগরী" vs "কারিগরি".
 *
 * Folding is deliberately conservative — only separators and vowel *length*,
 * which in Bengali orthography vary freely in job titles without changing the
 * word. It does not touch consonants, so two genuinely different posts cannot
 * fold together.
 */
export function loose(s: unknown): string {
  return norm(s)
    .replace(/[\s\-–—]/g, "")
    .replace(/ী/g, "ি")
    .replace(/ূ/g, "ু")
    .replace(/ঈ/g, "ই")
    .replace(/ঊ/g, "উ");
}
