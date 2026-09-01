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
 * May a CM licence be applied for for this product at all?
 *
 * **The closed list of 315.** Spec §1 draws the asymmetry that shapes this
 * module: "CM/Chemical/Physical operate on a closed list of 315 products.
 * Metrology operates on an open product universe." A CM licence is the
 * *mandatory* quality licence — the permission to sell a product the state has
 * placed under compulsory certification. A product outside that list is one
 * anyone may make and sell; it is not a thing BSTI licences.
 *
 * So a non-mandatory product is refused here rather than three screens later,
 * and the refusal tells the applicant the useful half: they do not need this
 * licence. That is a better answer than hiding the product from the picker,
 * which would tell someone whose article is genuinely unregulated only that
 * BSTI has never heard of it.
 *
 * Reads `Product.isMandatory`, which is **real data** — BSTI's published list,
 * parsed into `prisma/data/mandatory-315.json`. Every row loaded from that list
 * is mandatory; the column exists because Metrology works over an open product
 * universe and will add rows that are not.
 */
export function productEligibilityPolicy(product: {
  isMandatory: boolean;
  nameEn: string;
}): PolicyVerdict {
  if (!product.isMandatory) {
    return {
      allowed: false,
      reason: `${product.nameEn} is not on BSTI's mandatory certification list, so no quality licence is required to sell it — and none can be issued. If you believe it does require a licence, contact the CM Wing.`,
    };
  }
  return { allowed: true };
}

/**
 * D48 — a product that names several standards needs **all** of them.
 *
 * Confirmed by the client 2026-09-01. 24 of the 315 name more than one, and
 * they are not alternatives: a multi-part standard (`BDS ISO 4427-1/-2/-3`) is
 * one specification split across catalogue rows, so certifying the article
 * means conforming to every part. Attaching one part and calling the file
 * complete would put a licence behind a fraction of its own specification.
 *
 * The consequence is structural, which is why it is written down here: an
 * application consumes **one purchase per standard**, so the old single
 * `Application.bdsPurchaseId` is gone and `BdsPurchase.consumedByApplicationId`
 * is no longer UNIQUE. The rule that a purchase serves one application only is
 * unchanged — that direction was never what the unique index enforced.
 */
export function standardsRequiredPolicy(): "all" | "any" | "primary" {
  return "all";
}

/**
 * What a standard sells for — **and the price question that is still open.**
 *
 * The rule itself lives in `lib/store/bds-catalog.ts`, because the price of a
 * standard belongs to the store that sells it, not to the module that happens
 * to require one (spec §1 — a module never owns data another module needs). It
 * is re-exported here so the CM screens have it where the rest of their policy
 * is, and so this file still lists every unresolved question.
 *
 * **[ASSUMPTION — needs the Standards Wing's price list]** D45 established that
 * a standard the mandatory list names but the catalogue does not price is not
 * for sale: the stand-in is ৳0, and selling at ৳0 would hand out a purchase for
 * nothing. That left all 375 imported standards unsaleable and, by consequence,
 * no CM application able to reach submission.
 *
 * **D49, decided 2026-09-01: a demo price stands in while the platform is on
 * the sandbox gateway.** No real money can move — `PAYMENT_PROVIDER` defaults
 * to the sandbox, every payment it touches is stamped `isSandbox` for ever, and
 * the hosted page, the buy button and the receipt all say so. The honesty D45
 * was protecting is kept by *labelling* rather than by refusing:
 * `isProvisional` travels with the price to every screen that shows it.
 */
export { salePricePolicy, DEMO_PRICE_BDT } from "@/lib/store/bds-catalog";

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
 * One article the licence would cover, as the form submits it.
 *
 * Prisma-free (D9) so the wizard validates with the same rules the route
 * enforces — the applicant should be told what is wrong before they submit it,
 * and told the same thing if they get past the form.
 */
export type SkuInput = {
  brandName: string;
  variant?: string | null;
  sizeTypeId: number;
  sizeUnitId: number;
  sizeValue?: number | string | null;
  packaging?: string | null;
  unitsPerPack?: number | string | null;
  grade?: string | null;
};

export type SkuProblem = { field: string; message: string };

/**
 * What makes a SKU valid.
 *
 * **Brand and size are required** (the client's rule, 2026-09-01): an article
 * with neither cannot be identified on a shelf or named on a certificate.
 * Everything else is optional because it does not apply to every product —
 * cement has no flavour, a biscuit has no grade.
 *
 * A `numeric` size type needs a positive number beside its unit; a
 * `categorical` one must not carry a number at all, because "size M × 3" is not
 * a size. That is the whole reason `SizeKind` exists.
 */
export function validateSku(
  sku: SkuInput,
  sizeType: { kind: string; nameEn: string } | null,
): SkuProblem[] {
  const problems: SkuProblem[] = [];

  if (!sku.brandName || sku.brandName.trim() === "") {
    problems.push({ field: "brandName", message: "Brand is required." });
  }

  if (!sizeType) {
    problems.push({ field: "sizeTypeId", message: "Choose how this size is measured." });
    return problems;
  }

  if (sizeType.kind === "numeric") {
    const n = typeof sku.sizeValue === "string" ? Number(sku.sizeValue) : sku.sizeValue;
    if (n === null || n === undefined || Number.isNaN(n)) {
      problems.push({ field: "sizeValue", message: `Enter the ${sizeType.nameEn.toLowerCase()}.` });
    } else if (n <= 0) {
      problems.push({ field: "sizeValue", message: "Size must be greater than zero." });
    }
  } else if (sku.sizeValue !== null && sku.sizeValue !== undefined && sku.sizeValue !== "") {
    // A chart size is the whole answer. A number beside it would be a second,
    // contradictory size that nothing downstream could resolve.
    problems.push({
      field: "sizeValue",
      message: `${sizeType.nameEn} sizes are chosen, not measured — leave the number blank.`,
    });
  }

  const per =
    typeof sku.unitsPerPack === "string" ? Number(sku.unitsPerPack) : sku.unitsPerPack;
  if (per !== null && per !== undefined && sku.unitsPerPack !== "") {
    if (Number.isNaN(per) || !Number.isInteger(per) || per < 1) {
      problems.push({
        field: "unitsPerPack",
        message: "Units per pack must be a whole number of 1 or more.",
      });
    }
  }

  return problems;
}

/** `Orange — 200 ml × 24, paper-based can`. One SKU on one line. */
export function describeSku(sku: {
  brandName: string;
  variant?: string | null;
  sizeValue?: number | string | null;
  sizeUnit: { code: string };
  packaging?: string | null;
  unitsPerPack?: number | null;
  grade?: string | null;
}): string {
  const size = sku.sizeValue ? `${sku.sizeValue} ${sku.sizeUnit.code}` : sku.sizeUnit.code;
  const parts = [
    sku.brandName,
    sku.variant || null,
    sku.unitsPerPack ? `${size} × ${sku.unitsPerPack}` : size,
    sku.packaging || null,
    sku.grade || null,
  ].filter(Boolean);
  return parts.join(" — ");
}

/**
 * What still stands between this application and submission.
 *
 * One function, like `missingForSubmission()` on the company side and for the
 * same reason: the requirement set is an assumption, and named gaps tell the
 * applicant what to do next where a percentage does not.
 */
export type Gap = { field: string; label: string };

export function missingForSubmission(app: {
  productId: number | null;
  /** The chosen product, so eligibility is re-checked at the money gate. */
  product?: { isMandatory: boolean; nameEn: string } | null;
  /**
   * Every standard the product names, and whether this application holds an
   * attached purchase of it. All of them are required (D48).
   */
  standards: { number: string; attached: boolean }[];
  /** Every article the licence would cover (D51). At least one is required. */
  skuCount: number;
  factoryId: number | null;
  documents: { kind: string }[];
  organizationComplete: boolean;
}): Gap[] {
  const gaps: Gap[] = [];
  if (!app.organizationComplete)
    gaps.push({ field: "organization", label: "Complete the company profile" });
  if (!app.factoryId) gaps.push({ field: "factory", label: "Choose the factory" });
  if (!app.productId) gaps.push({ field: "product", label: "Choose the product to certify" });
  else if (app.product && !productEligibilityPolicy(app.product).allowed) {
    // Second layer on the closed list of 315: `setProduct()` refuses one, but a
    // row written before the rule existed — or a product later taken off the
    // list — must not reach the fee.
    gaps.push({ field: "product", label: "Choose a product under mandatory certification" });
  } else {
    // One gap per unattached standard, named. A product needing three parts
    // and holding one should say which two are missing, not "attach your
    // purchases".
    for (const std of app.standards.filter((s) => !s.attached)) {
      gaps.push({ field: `bds:${std.number}`, label: `Attach your purchase of ${std.number}` });
    }
    if (app.standards.length === 0) {
      // A mandatory product with no standard recorded cannot be certified
      // against anything. Data fault rather than applicant fault, so it names
      // itself as one.
      gaps.push({
        field: "product",
        label: "This product has no standard recorded — contact BSTI",
      });
    }
  }

  // A licence names the articles it covers, so a file that names none is not a
  // licence anyone could issue — and the SKUs decide how many samples are drawn
  // at inspection, so the reviewing officer cannot plan without them.
  if (app.productId && app.skuCount === 0) {
    gaps.push({ field: "skus", label: "List at least one product variant (SKU)" });
  }

  const held = new Set(app.documents.map((d) => d.kind));
  for (const req of CM_DOCUMENTS) {
    if (req.required && !held.has(req.kind)) {
      gaps.push({ field: `doc:${req.kind}`, label: req.label });
    }
  }
  return gaps;
}
