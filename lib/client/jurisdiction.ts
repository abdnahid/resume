/**
 * Which BSTI office receives an application from a given factory.
 *
 * A quality licence is granted for a product made at a specific premises, so
 * the *factory's* district decides the office — not the company's registered
 * address, which is often a city head office far from the plant.
 *
 * **The real jurisdiction map is not in this repo.** BSTI has 23 offices and
 * Bangladesh has 64 districts, so most offices cover several districts and the
 * boundaries are an administrative decision, not a geographic one. Until that
 * map is supplied this resolves by a documented default:
 *
 *   1. an office in the factory's own district, if there is one;
 *   2. otherwise the divisional office for that district's division;
 *   3. otherwise Head Office.
 *
 * `resolveJurisdiction()` is the single named function that decision lives
 * behind (D8), so replacing the default with the real map changes one place.
 *
 * Prisma-free: the caller passes the offices in.
 */
import { BD_DIVISIONS } from "@/lib/bdGeoData";

export type JurisdictionOffice = {
  id: number;
  nameEn: string;
  nameBn: string;
  type: string;
};

export type Jurisdiction = {
  officeId: number;
  /** How it was decided, so the UI can explain rather than assert. */
  basis: "district" | "division" | "fallback";
  note: string;
};

/** Bengali district name → its division, from the address geography. */
function divisionOfDistrict(district: string): string | null {
  const d = district.trim();
  for (const div of BD_DIVISIONS) {
    if (div.districts.some((x) => x.name === d)) return div.name;
  }
  return null;
}

/**
 * Does an office sit in this place? Offices are named
 * "<kind> কার্যালয়, বিএসটিআই, <city>", so the city is matched against the name
 * — the same rule the payroll zone mapping uses, and for the same reason: the
 * address contains highway and bus-stand names that produce false hits.
 */
function officeIsIn(office: JurisdictionOffice, placeBn: string): boolean {
  const place = placeBn.trim();
  if (!place) return false;
  return office.nameBn.includes(place);
}

/**
 * Which office outranks which, when more than one sits in the same place.
 * Lower is more senior.
 */
const OFFICE_SENIORITY: Record<string, number> = {
  head: 0,
  divisional: 1,
  district: 2,
  regional: 3,
  dmi: 4,
};

function seniority(o: JurisdictionOffice): number {
  return OFFICE_SENIORITY[o.type] ?? 9;
}

export function resolveJurisdiction(
  offices: JurisdictionOffice[],
  district: string | null | undefined,
): Jurisdiction | null {
  if (!offices.length) return null;

  const headOffice = offices.find((o) => o.type === "head") ?? offices[0];

  const d = (district ?? "").trim();
  if (!d) {
    return {
      officeId: headOffice.id,
      basis: "fallback",
      note: "No district on the factory address — defaulted to Head Office.",
    };
  }

  // 1. An office in the district itself. Several may sit in one city — Head
  //    Office and DMI are both in Dhaka — so the senior one wins rather than
  //    whichever the list happens to hold first.
  const inDistrict = offices
    .filter((o) => officeIsIn(o, d))
    .sort((a, b) => seniority(a) - seniority(b))[0];
  if (inDistrict) {
    return {
      officeId: inDistrict.id,
      basis: "district",
      note: `${inDistrict.nameEn} is in ${d}.`,
    };
  }

  // 2. The office serving that district's division. Dhaka division has no
  //    office of type `divisional` — Head Office serves it — so a `head` office
  //    counts here too.
  const division = divisionOfDistrict(d);
  if (division) {
    const divisional = offices
      .filter(
        (o) =>
          (o.type === "divisional" || o.type === "head") && officeIsIn(o, division),
      )
      .sort((a, b) => seniority(a) - seniority(b))[0];
    if (divisional) {
      return {
        officeId: divisional.id,
        basis: "division",
        note: `No office in ${d}; ${division} division is served by ${divisional.nameEn}.`,
      };
    }
  }

  // 3. Head office.
  return {
    officeId: headOffice.id,
    basis: "fallback",
    note: `No office found for ${d}${division ? ` or ${division} division` : ""} — defaulted to Head Office.`,
  };
}
