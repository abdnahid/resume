/**
 * Citizen-facing services — what a member of the public can actually do here.
 *
 * Deliberately *not* `lib/modules.ts`. That registry lists internal modules and
 * drives staff navigation; showing it to a visitor advertises five destinations
 * they will be refused at (D14). This is the public-facing counterpart.
 *
 * Prisma-free — the landing page and any client component may import it.
 */

export type ServiceStatus =
  /** Built and reachable today. */
  | { kind: "live"; href: string }
  /** Not built yet. Rendered disabled with `note` — never as a dead link. */
  | { kind: "planned"; note: string };

export type CitizenService = {
  key: string;
  /** Icon name resolved by the rendering component, as `lib/modules.ts` does. */
  icon: "standards" | "certificate" | "verify";
  label: string;
  labelBn: string;
  blurb: string;
  status: ServiceStatus;
};

export const CITIZEN_SERVICES: readonly CitizenService[] = [
  {
    key: "bds-store",
    icon: "standards",
    label: "Bangladesh Standards",
    labelBn: "বাংলাদেশ মান",
    blurb:
      "Browse and buy published BDS standards. Search by division, price and publication date — no account needed to look.",
    status: { kind: "live", href: "/store/bds" },
  },
  {
    key: "quality-certificate",
    icon: "certificate",
    label: "Quality Certificate (CM)",
    labelBn: "মান সনদ",
    blurb:
      "Apply for a CM quality certification licence for a product manufactured at your factory, and track the file through every stage.",
    status: { kind: "live", href: "/public/services/cm-licence" },
  },
  {
    key: "verify-certificate",
    icon: "verify",
    label: "Verify a certificate",
    labelBn: "সনদ যাচাই",
    blurb:
      "Check whether a licence or certificate number is genuine and still valid. Public lookup, no sign-in.",
    status: {
      kind: "planned",
      note: "Arrives with the CM module.",
    },
  },
];
