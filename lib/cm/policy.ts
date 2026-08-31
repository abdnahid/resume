/**
 * Every unresolved CM policy question, in one file (D8).
 *
 * Spec §10 lists twelve decisions "needed before coding", ordered by how much
 * rework each causes if answered late. Several are still unanswered, and the
 * application flow cannot wait for them — so each gets a named function with the
 * chosen default, the reasoning, and what changes when the real answer arrives.
 *
 * Prisma-free (D9): the wizard imports this to explain itself to the applicant,
 * and the routes import it to enforce it.
 */

export type PolicyVerdict = {
  allowed: boolean;
  /** Shown to the applicant. Never a bare "not allowed". */
  reason?: string;
};

/**
 * §10 #2 — may a *superseded* edition be attached?
 *
 * **Default: yes, with a warning.** The spec notes this "will happen
 * constantly". Refusing outright means someone who bought BDS 1234:2019 last
 * month, before it was superseded, has paid for a standard they cannot use and
 * must buy again — which reads as a penalty for BSTI's own publication
 * schedule. A warning puts the choice in front of them and leaves the reviewing
 * officer a record that it was flagged.
 *
 * `withdrawn` is refused outright: a withdrawn standard is not a specification
 * anything can be certified against.
 */
export function bdsEditionPolicy(status: string): PolicyVerdict & { warning?: string } {
  if (status === "withdrawn") {
    return {
      allowed: false,
      reason:
        "This standard has been withdrawn and cannot be used for certification. Please buy the standard that replaced it.",
    };
  }
  if (status === "superseded") {
    return {
      allowed: true,
      warning:
        "A newer edition of this standard has been published. You may apply against this edition, but the reviewing officer may ask you to move to the current one.",
    };
  }
  return { allowed: true };
}

/**
 * May a CM licence be applied for against this standard at all?
 *
 * **The closed list of 315.** Spec §1 draws the asymmetry that shapes this
 * module: "CM/Chemical/Physical operate on a closed list of 315 products.
 * Metrology operates on an open product universe." A CM licence is the
 * *mandatory* quality licence — the permission to sell a product the state has
 * placed under compulsory certification. A standard outside that list is a
 * specification anyone may build to; it is not a thing BSTI licences.
 *
 * So a non-mandatory standard is refused here rather than three screens later,
 * and the refusal tells the applicant the useful half: they do not need this
 * licence. That is a better answer than hiding the standard from the picker,
 * which would tell someone whose product is genuinely unregulated only that
 * BSTI has never heard of it.
 *
 * **[ASSUMPTION — needs the real 315 list]** `isMandatory315` is seeded from the
 * catalogue seed's own judgement, and 15 of the 55 seeded standards carry it.
 * The authoritative list is Phase G reference data. Populating the flag is a
 * data job; this function is where the *rule* lives, and it does not change
 * when the data arrives.
 */
export function productEligibilityPolicy(bds: {
  isMandatory315: boolean;
  status: string;
}): PolicyVerdict {
  const edition = bdsEditionPolicy(bds.status);
  if (!edition.allowed) return edition;

  if (!bds.isMandatory315) {
    return {
      allowed: false,
      reason:
        "This standard is not on BSTI's mandatory certification list, so no quality licence is required to sell products made to it — and none can be issued. You may still buy the standard and manufacture to it. If you believe this product does require a licence, contact the CM Wing.",
    };
  }
  return { allowed: true };
}

/**
 * §10 #4 — may a group member attach a purchase the mother organisation made?
 *
 * **Default: no.** The spec's own view — "cleanest answer is no (purchase is
 * party-scoped), but it will generate complaints, so decide deliberately". A
 * purchase is a party-scoped asset, and the licence is issued to the member,
 * not the parent (D29); letting the parent's single purchase seed applications
 * for every member would quietly make one purchase serve many licences, which
 * is the exact thing §3.3 exists to prevent.
 *
 * The complaint this generates is real, so the message says what to do instead
 * rather than only refusing.
 */
export function purchaseOwnershipPolicy(
  purchaseOrganizationId: number | null,
  applicantOrganizationId: number,
): PolicyVerdict {
  if (purchaseOrganizationId === null) {
    // Bought personally, before the buyer was acting for any company. Theirs to
    // use — refusing would strand every purchase made before a profile existed.
    return { allowed: true };
  }
  if (purchaseOrganizationId === applicantOrganizationId) return { allowed: true };
  return {
    allowed: false,
    reason:
      "This standard was bought by another company in your group. A purchase belongs to the company that bought it, so please buy the standard under this company to apply with it.",
  };
}

/**
 * §10 #3 — does a purchase free up when an application is withdrawn or
 * rejected?
 *
 * **Default: freed on withdrawal, consumed on rejection.** Withdrawing before
 * anyone has looked at the file costs BSTI nothing, so holding the purchase
 * hostage is punitive. A rejection follows real review work against that
 * standard, and freeing it would let an applicant retry indefinitely on one
 * purchase.
 *
 * Nothing calls this yet — rejection and withdrawal are Phase 2 — but the
 * decision belongs beside its siblings rather than being rediscovered later.
 */
export function purchaseReleasePolicy(
  terminalState: "withdrawn" | "rejected" | "lapsed",
): { release: boolean; reason: string } {
  switch (terminalState) {
    case "withdrawn":
      return { release: true, reason: "Withdrawn before review — the standard may be reused." };
    case "lapsed":
      return {
        release: true,
        reason: "Lapsed without review — the standard may be reused.",
      };
    case "rejected":
      return {
        release: false,
        reason: "Rejected after review — the standard is consumed by that application.",
      };
  }
}

/**
 * The application fee.
 *
 * **[ASSUMPTION — needs the CM fee schedule]** A flat ৳1,000 stands in. The
 * real schedule varies by product category and licence type, and the category
 * table is Phase G reference data that does not exist yet.
 *
 * Returned in poisha, as the payment service expects, and as the *income* half
 * — VAT is added by `splitFee()`, so this must never include it.
 */
export const APPLICATION_FEE_POISHA = 100_000;

export function applicationFeePoisha(): number {
  return APPLICATION_FEE_POISHA;
}

/**
 * The documents a CM application must carry.
 *
 * **[ASSUMPTION — needs CM Wing confirmation]**, the same standing as the
 * company field set in §2.3. Listed as data so the real list is an edit here
 * rather than a form rewrite.
 */
export type DocumentRequirement = {
  kind: string;
  label: string;
  hint?: string;
  required: boolean;
};

export const CM_DOCUMENTS: readonly DocumentRequirement[] = [
  {
    kind: "trade_licence",
    label: "Trade licence",
    hint: "Current, in the applicant company's name.",
    required: true,
  },
  {
    kind: "tin_certificate",
    label: "TIN certificate",
    required: true,
  },
  {
    kind: "bin_certificate",
    label: "BIN / VAT registration certificate",
    required: true,
  },
  {
    kind: "factory_layout",
    label: "Factory layout plan",
    hint: "Showing the production line the application covers.",
    required: true,
  },
  {
    kind: "machinery_list",
    label: "List of machinery and production capacity",
    required: true,
  },
  {
    kind: "test_equipment",
    label: "List of in-house testing equipment",
    hint: "With calibration certificates where held.",
    required: true,
  },
  {
    kind: "raw_material",
    label: "Raw material sources",
    required: false,
  },
  {
    kind: "flow_chart",
    label: "Production flow chart",
    required: false,
  },
  {
    kind: "label_artwork",
    label: "Product label / packaging artwork",
    hint: "As it appears on the article sold.",
    required: true,
  },
];

/**
 * What still stands between this application and submission.
 *
 * One function, like `missingForSubmission()` on the company side and for the
 * same reason: the requirement set is an assumption, and named gaps tell the
 * applicant what to do next where a percentage does not.
 */
export type Gap = { field: string; label: string };

export function missingForSubmission(app: {
  bdsId: number | null;
  /** The chosen standard, so eligibility is re-checked at the money gate. */
  bds?: { isMandatory315: boolean; status: string } | null;
  bdsPurchaseId: number | null;
  factoryId: number | null;
  documents: { kind: string }[];
  organizationComplete: boolean;
}): Gap[] {
  const gaps: Gap[] = [];
  if (!app.organizationComplete)
    gaps.push({ field: "organization", label: "Complete the company profile" });
  if (!app.factoryId) gaps.push({ field: "factory", label: "Choose the factory" });
  if (!app.bdsId) gaps.push({ field: "product", label: "Choose the product to certify" });
  else if (app.bds && !productEligibilityPolicy(app.bds).allowed) {
    // Second layer on the closed list of 315: `setProduct()` refuses one, but a
    // row written before the rule existed — or a standard later taken off the
    // list — must not reach the fee.
    gaps.push({ field: "product", label: "Choose a product under mandatory certification" });
  } else if (!app.bdsPurchaseId)
    gaps.push({ field: "bds", label: "Attach your purchase of that standard" });

  const held = new Set(app.documents.map((d) => d.kind));
  for (const req of CM_DOCUMENTS) {
    if (req.required && !held.has(req.kind)) {
      gaps.push({ field: `doc:${req.kind}`, label: req.label });
    }
  }
  return gaps;
}
