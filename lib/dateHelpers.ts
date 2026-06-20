export function toDate(s: string): Date | undefined {
  if (!s) return undefined;
  const p = s.split("-").map(Number);
  if (p.length !== 3 || p.some(isNaN)) return undefined;
  return new Date(p[2], p[1] - 1, p[0]);
}

export function fromDate(d: Date): string {
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("-");
}
