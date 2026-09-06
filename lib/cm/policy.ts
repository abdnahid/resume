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
  /**
   * The packaging artwork for this article — **metadata only**. The bytes are
   * not kept: there is no document store yet, and a form that silently drops a
   * file is worse than one that says it cannot take it.
   */
  labelImageName?: string | null;
  labelImageSizeBytes?: number | null;
  labelImageMime?: string | null;
};

/** What a label image may be. Checked server-side, not just by the file input. */
export const LABEL_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const LABEL_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export function validateLabelImage(input: {
  labelImageName?: string | null;
  labelImageSizeBytes?: number | null;
  labelImageMime?: string | null;
}): SkuProblem | null {
  if (!input.labelImageName) return null;
  if (input.labelImageMime && !LABEL_IMAGE_MIMES.includes(input.labelImageMime as never)) {
    return { field: "labelImage", message: "The label must be a JPEG, PNG, WebP or PDF." };
  }
  if ((input.labelImageSizeBytes ?? 0) > LABEL_IMAGE_MAX_BYTES) {
    return { field: "labelImage", message: "The label must be 8 MB or smaller." };
  }
  return null;
}

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

/**
 * The authorities a Bangladeshi manufacturer's approved capacity is registered
 * with. Fixed list rather than free text: the figure in step 3 means "approved
 * by whom", and an unnamed approver is not a reference.
 */
export const CAPACITY_AUTHORITIES = [
  { value: "bida", labelEn: "BIDA", nameEn: "Bangladesh Investment Development Authority" },
  { value: "beza", labelEn: "BEZA", nameEn: "Bangladesh Economic Zones Authority" },
  { value: "bepza", labelEn: "BEPZA", nameEn: "Bangladesh Export Processing Zones Authority" },
  { value: "bscic", labelEn: "BSCIC", nameEn: "Bangladesh Small and Cottage Industries Corporation" },
  { value: "other", labelEn: "Other", nameEn: "Registered elsewhere, or not registered" },
] as const;

export type CapacityAuthorityValue = (typeof CAPACITY_AUTHORITIES)[number]["value"];

export function isCapacityAuthority(v: unknown): v is CapacityAuthorityValue {
  return CAPACITY_AUTHORITIES.some((a) => a.value === v);
}

/**
 * What BSTI asks about how the factory actually runs.
 *
 * **[ASSUMPTION — needs CM Wing confirmation]**, the same standing as
 * `CM_DOCUMENTS`. Drafted from the client's own list: identification,
 * isolation on a quality problem, the manufacturing steps, manpower, the
 * quality-control system, and records. Data rather than a form, so the real
 * set is an edit here and never a migration — `ApplicationAnswer` is keyed by
 * `key`, not columned.
 *
 * `number` questions store `answerNumber`; everything else stores `answerText`.
 */
export type QuestionGroup = {
  key: string;
  titleEn: string;
  blurbEn?: string;
  questions: readonly Question[];
};

export type Question = {
  key: string;
  labelEn: string;
  hintEn?: string;
  type: "text" | "longtext" | "number";
  required: boolean;
};

export const CM_QUESTIONS: readonly QuestionGroup[] = [
  {
    key: "identification",
    titleEn: "Identification and traceability",
    blurbEn:
      "How a finished article can be traced back to the batch that made it. This is what makes a recall possible.",
    questions: [
      {
        key: "how_identified",
        labelEn: "How are the products identified?",
        hintEn: "Batch or lot coding, date of manufacture, shift marking — whatever is printed on the article or its pack.",
        type: "longtext",
        required: true,
      },
      {
        key: "isolation",
        labelEn: "How does the system allow products to be isolated if there is a quality problem?",
        hintEn: "How a suspect batch is held back, and how far it can be traced once it has left the factory.",
        type: "longtext",
        required: true,
      },
    ],
  },
  {
    key: "process",
    titleEn: "Manufacturing process",
    questions: [
      {
        key: "process_steps",
        labelEn: "Describe the stages of manufacture, in order.",
        hintEn:
          "A production schedule or a flow chart showing the stages is helpful — you can also attach one as the production flow chart document.",
        type: "longtext",
        required: true,
      },
      {
        key: "process_outsourced",
        labelEn: "Is any stage carried out by another party?",
        hintEn: "Contract filling, printing, sterilising. Name the stage and who does it, or write None.",
        type: "text",
        required: false,
      },
    ],
  },
  {
    key: "manpower",
    titleEn: "Manpower",
    questions: [
      { key: "manpower_total", labelEn: "Total employees at this factory", type: "number", required: true },
      { key: "manpower_technical", labelEn: "Technical and production staff", type: "number", required: true },
      { key: "manpower_qc", labelEn: "Staff engaged in quality control", type: "number", required: true },
      {
        key: "manpower_qc_incharge",
        labelEn: "Who is in charge of quality control, and what are their qualifications?",
        type: "text",
        required: true,
      },
    ],
  },
  {
    key: "quality",
    titleEn: "Quality control system",
    questions: [
      {
        key: "qc_stages",
        labelEn: "How is quality checked on raw materials, during production, and on the finished product?",
        type: "longtext",
        required: true,
      },
      {
        key: "qc_lab",
        labelEn: "What testing can you do in your own laboratory?",
        hintEn: "Which tests in the standard you can run yourselves, and which you send out.",
        type: "longtext",
        required: true,
      },
      {
        key: "qc_calibration",
        labelEn: "How is testing equipment calibrated, and how often?",
        type: "text",
        required: true,
      },
      {
        key: "qc_nonconforming",
        labelEn: "What happens to product that fails a test?",
        type: "longtext",
        required: true,
      },
    ],
  },
  {
    key: "records",
    titleEn: "Records and documentation",
    questions: [
      {
        key: "rec_kept",
        labelEn: "What production and testing records are kept, and for how long?",
        type: "longtext",
        required: true,
      },
      {
        key: "rec_complaints",
        labelEn: "How are customer complaints recorded and acted on?",
        type: "longtext",
        required: true,
      },
    ],
  },
];

export const CM_QUESTION_INDEX: ReadonlyMap<string, Question> = new Map(
  CM_QUESTIONS.flatMap((g) => g.questions.map((q) => [q.key, q] as const)),
);

/**
 * The four steps of the application form.
 *
 * The form is stepped rather than one long page because the four ask different
 * things of different people: step 1 is a check of what the company already
 * told us, step 2 is the product, step 3 is numbers from the plant, step 4 is a
 * description of how it is run. A single page hid how much was left and made
 * the company details — which the applicant can only fix elsewhere — look like
 * just more fields to fill.
 */
export const FORM_STEPS = [
  { step: 1, key: "company", titleEn: "Company and factory", blurbEn: "Check what BSTI holds about you" },
  { step: 2, key: "product", titleEn: "Product and articles", blurbEn: "What you are certifying" },
  { step: 3, key: "production", titleEn: "Production capacity", blurbEn: "What the plant makes" },
  { step: 4, key: "practice", titleEn: "How the factory runs", blurbEn: "BSTI's questions, and your declaration" },
] as const;

export type FormStep = (typeof FORM_STEPS)[number]["step"];

/** `step` is what lets the tracker say *where* a file is incomplete. */
export type Gap = { field: string; label: string; step: FormStep };

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
  /** Step 3. Null until the applicant fills it in. */
  production?: { annualCapacityValue: unknown; currentYearLabel: string } | null;
  /** Step 4 — every answer held, keyed by question. */
  answers?: { questionKey: string; answerText: string | null; answerNumber: number | null }[];
  consentAcceptedAt?: Date | null;
}): Gap[] {
  const gaps: Gap[] = [];
  if (!app.organizationComplete)
    gaps.push({ field: "organization", label: "Complete the company profile", step: 1 });
  if (!app.factoryId) gaps.push({ field: "factory", label: "Choose the factory", step: 1 });
  if (!app.productId) gaps.push({ field: "product", label: "Choose the product to certify", step: 2 });
  else if (app.product && !productEligibilityPolicy(app.product).allowed) {
    // Second layer on the closed list of 315: `setProduct()` refuses one, but a
    // row written before the rule existed — or a product later taken off the
    // list — must not reach the fee.
    gaps.push({ field: "product", label: "Choose a product under mandatory certification", step: 2 });
  } else {
    // One gap per unattached standard, named. A product needing three parts
    // and holding one should say which two are missing, not "attach your
    // purchases".
    for (const std of app.standards.filter((s) => !s.attached)) {
      gaps.push({ field: `bds:${std.number}`, label: `Attach your purchase of ${std.number}`, step: 2 });
    }
    if (app.standards.length === 0) {
      // A mandatory product with no standard recorded cannot be certified
      // against anything. Data fault rather than applicant fault, so it names
      // itself as one.
      gaps.push({
        field: "product",
        label: "This product has no standard recorded — contact BSTI",
        step: 2,
      });
    }
  }

  // A licence names the articles it covers, so a file that names none is not a
  // licence anyone could issue — and the SKUs decide how many samples are drawn
  // at inspection, so the reviewing officer cannot plan without them.
  if (app.productId && app.skuCount === 0) {
    gaps.push({ field: "skus", label: "List at least one product variant (SKU)", step: 2 });
  }

  const held = new Set(app.documents.map((d) => d.kind));
  for (const req of CM_DOCUMENTS) {
    if (req.required && !held.has(req.kind)) {
      gaps.push({ field: `doc:${req.kind}`, label: req.label, step: 2 });
    }
  }

  // Step 3 — the plant's capacity for this product. Checked as a whole rather
  // than field by field: the row is written in one save, so it is either given
  // or it is not.
  if (app.production === null || app.production === undefined) {
    gaps.push({ field: "production", label: "Give the production capacity and this year's output", step: 3 });
  }

  // Step 4 — BSTI's questions, then the declaration. The declaration is last on
  // purpose: it says the answers above are true, so it cannot be given first.
  if (app.answers) {
    const answered = new Map(app.answers.map((a) => [a.questionKey, a]));
    for (const group of CM_QUESTIONS) {
      for (const q of group.questions) {
        if (!q.required) continue;
        const a = answered.get(q.key);
        const given =
          q.type === "number" ? typeof a?.answerNumber === "number" : !!a?.answerText?.trim();
        if (!given) gaps.push({ field: `q:${q.key}`, label: q.labelEn, step: 4 });
      }
    }
  }
  if (!app.consentAcceptedAt) {
    gaps.push({ field: "consent", label: "Confirm the declaration", step: 4 });
  }

  return gaps;
}

/** How complete each step is — what the tracker renders. */
export function stepProgress(gaps: Gap[]) {
  return FORM_STEPS.map((s) => {
    const outstanding = gaps.filter((g) => g.step === s.step);
    return { ...s, outstanding: outstanding.length, complete: outstanding.length === 0 };
  });
}

// ─── Shortfall targets (D81) ────────────────────────────────────────────────

/**
 * The parts of an application a reviewing officer can reopen for correction.
 *
 * **A shortfall is an edit permission, not a note.** The officer marks points;
 * exactly those parts become editable again and nothing else does. So the
 * points have to be a closed list the form can be keyed on — a free-text
 * "please fix your capacity figures" cannot be turned into a permission, and an
 * application reopened wholesale invites changes nobody asked for after the
 * fee has been paid.
 *
 * `step` is which page of the four-step form the target lives on, so the
 * applicant can be sent straight there.
 *
 * Documents are addressed one at a time as `document:<kind>` — "your trade
 * licence has expired" should not reopen the whole checklist. `DOCUMENT_TARGET`
 * builds the key; `SHORTFALL_SECTIONS` covers everything else.
 */
export type ShortfallSection = {
  target: string;
  label: string;
  hint: string;
  step: 1 | 2 | 3 | 4;
};

export const SHORTFALL_SECTIONS: readonly ShortfallSection[] = [
  {
    target: "product",
    label: "Product and standards",
    hint: "The wrong product was chosen, or the standards attached do not certify it.",
    step: 2,
  },
  {
    target: "sub_products",
    label: "Sub-products",
    hint: "The variants declared do not match what the factory makes.",
    step: 2,
  },
  {
    target: "skus",
    label: "Brands, sizes and packaging",
    hint: "An article is missing, duplicated, or described wrongly.",
    step: 2,
  },
  {
    target: "production",
    label: "Production capacity",
    hint: "The capacity, the year's production, or the authority stating it.",
    step: 3,
  },
  {
    target: "answers",
    label: "BSTI's questions",
    hint: "An answer is missing, or does not describe what the factory does.",
    step: 4,
  },
] as const;

export const DOCUMENT_TARGET_PREFIX = "document:";
export const documentTarget = (kind: string) => `${DOCUMENT_TARGET_PREFIX}${kind}`;
export const isDocumentTarget = (target: string) => target.startsWith(DOCUMENT_TARGET_PREFIX);
export const documentKindOf = (target: string) => target.slice(DOCUMENT_TARGET_PREFIX.length);

/** Every target an officer may mark, sections first and then each document. */
export function allShortfallTargets(): ShortfallSection[] {
  return [
    ...SHORTFALL_SECTIONS,
    ...CM_DOCUMENTS.map((d) => ({
      target: documentTarget(d.kind),
      label: d.label,
      hint: d.hint ?? "",
      step: 2 as const,
    })),
  ];
}

/**
 * A target's label, for showing back what was asked for.
 *
 * Artwork targets name a variant that only the caller can resolve, so they get
 * a generic label here; pages holding the SKU add the brand and size.
 */
export function shortfallLabel(target: string): string {
  if (target.startsWith("artwork:")) return "Packaging artwork";
  return allShortfallTargets().find((t) => t.target === target)?.label ?? target;
}

/**
 * Packaging artwork is marked per variant, not per application.
 *
 * A licence covers every brand, size and flavour separately and each is sold in
 * its own wrapper (D53), so "the artwork is wrong" is a statement about one jar.
 * Reopening every variant's artwork because one label is wrong would invite the
 * applicant to replace wrappers nobody questioned.
 *
 * The id is the `ApplicationSku`'s, so the target is only meaningful on the
 * application that owns it — `raiseShortfall` checks that before storing it.
 */
export const ARTWORK_TARGET_PREFIX = "artwork:";
export const artworkTarget = (skuId: number) => `${ARTWORK_TARGET_PREFIX}${skuId}`;
export const isArtworkTarget = (t: string) => t.startsWith(ARTWORK_TARGET_PREFIX);
export function artworkSkuIdOf(target: string): number | null {
  if (!isArtworkTarget(target)) return null;
  const n = Number(target.slice(ARTWORK_TARGET_PREFIX.length));
  return Number.isInteger(n) ? n : null;
}

// ─── The initial inspection report (D86) ────────────────────────────────────

/**
 * প্রারম্ভিক পরিদর্শন প্রতিবেদন — the form BSTI uses today, as rows.
 *
 * Taken from the wing's own `inspectionReport.html`. The five conditions and
 * nine marking checks are **rows rather than columns** for the reason the
 * shortfall points are: a tick against a named thing can be counted, reported
 * on and reordered when the form changes, and a column per item means a
 * migration every time the wing adds one.
 */
export type ConditionCheck = { key: string; labelBn: string; labelEn: string };

/** §2(খ) স্বাস্থ্য ও পরিবেশগত অবস্থা — satisfactory or not, with a remark. */
export const INSPECTION_CONDITIONS: readonly ConditionCheck[] = [
  { key: "surroundings", labelBn: "কারখানার পারিপার্শ্বিক", labelEn: "Factory surroundings" },
  { key: "raw_material_storage", labelBn: "কাঁচামাল সংরক্ষণ", labelEn: "Raw material storage" },
  { key: "processing_area", labelBn: "প্রক্রিয়ার স্থান", labelEn: "Processing area" },
  { key: "filling_packing", labelBn: "ফিলিং/প্যাকিং", labelEn: "Filling and packing" },
  { key: "finished_storage", labelBn: "উৎপাদিত পণ্য সংরক্ষণ", labelEn: "Finished goods storage" },
] as const;

/** §2(জ) মোড়কীকরণ এবং চিহ্নিতকরণ — present on the pack, or not. */
export const INSPECTION_MARKINGS: readonly ConditionCheck[] = [
  { key: "product_name", labelBn: "পণ্যের নাম", labelEn: "Product name" },
  { key: "company_name_address", labelBn: "প্রতিষ্ঠানের নাম ও পূর্ণ ঠিকানা", labelEn: "Company name and full address" },
  { key: "manufacture_date", labelBn: "উৎপাদনের তারিখ", labelEn: "Date of manufacture" },
  { key: "expiry_date", labelBn: "মেয়াদ উত্তীর্ণের তারিখ", labelEn: "Expiry date" },
  { key: "batch_code", labelBn: "ব্যাচ / কোড নং", labelEn: "Batch or code number" },
  { key: "standard_mark", labelBn: "মান চিহ্ন", labelEn: "Standard mark" },
  { key: "ingredients", labelBn: "উপাদান", labelEn: "Ingredients" },
  { key: "warnings", labelBn: "সতর্কতামূলক নির্দেশনা (প্রযোজ্য ক্ষেত্রে)", labelEn: "Warnings, where applicable" },
  { key: "weight_price", labelBn: "ওজন ও মূল্য", labelEn: "Weight and price" },
] as const;

/**
 * The narrative sections. Each is a paragraph the officer writes on the visit.
 *
 * The wing's form attaches a file to most of these — a machinery list, a
 * process description. **The bytes are still discarded** (there is no document
 * store), so recording a file that cannot be reopened would be worse than
 * asking for the substance in words. Each carries the original Bengali label so
 * the printed report matches the form officers already know.
 */
export type ReportField = { key: string; labelBn: string; labelEn: string; hint?: string };

export const INSPECTION_NARRATIVE: readonly ReportField[] = [
  { key: "machinery", labelBn: "ক) পণ্য উৎপাদনে ব্যবহৃত যন্ত্রপাতির তালিকা", labelEn: "Machinery used in production" },
  { key: "raw_materials", labelBn: "গ) ব্যবহৃত কাঁচামাল", labelEn: "Raw materials used" },
  { key: "process", labelBn: "ঘ) পণ্য প্রস্তুত প্রণালীর সংক্ষিপ্ত বিবরণ", labelEn: "Brief description of the process" },
  { key: "lab_equipment", labelBn: "ক) পণ্য পরীক্ষণের জন্য পরীক্ষাগারে স্থাপিত যন্ত্রপাতির তালিকা", labelEn: "Testing equipment in the factory laboratory" },
  { key: "qc_staff", labelBn: "খ) গুণগত মান নিরীক্ষায় নিয়োজিত কর্মকর্তাবৃন্দের তথ্য", labelEn: "Officers engaged in quality control" },
  { key: "record_keeping", labelBn: "গ) পরীক্ষণ প্রতিবেদন সংরক্ষণের পদ্ধতি", labelEn: "How test reports are retained" },
  { key: "outside_lab", labelBn: "ঘ) অন্য কোন পরীক্ষাগারে পণ্য পরীক্ষা করা হইলে পরীক্ষাগারের নাম ও প্রতিবেদন", labelEn: "Any outside laboratory used, and its report" },
  { key: "testing_programme", labelBn: "ঙ) কারখানার বিদ্যমান পরীক্ষণ ও পরিদর্শন কর্মসূচী", labelEn: "The factory's existing testing and inspection programme" },
  { key: "fee_discussion", labelBn: "ক) বাৎসরিক লাইসেন্স ফি সম্পর্কিত আলোচনা", labelEn: "Discussion of the annual licence fee" },
  { key: "mark_method", labelBn: "খ) গুণগত মান চিহ্ন সংযোজন পদ্ধতি সম্পর্কে আলোচনা", labelEn: "How the quality mark is to be applied" },
  { key: "recommendation", labelBn: "গ) পণ্যের গুণগত মান উন্নয়ন / সংরক্ষণ বিষয়ে পরামর্শ / সুপারিশ", labelEn: "Advice and recommendations on quality" },
] as const;

/**
 * D8 — how long the applicant has to deliver the sealed boxes.
 *
 * **Nobody has given us the real figure.** The samples travel in the
 * applicant's own custody between the factory and each One Stop counter (D72),
 * so the window is the whole of the control BSTI has over that leg: too long
 * and a perishable sample is worthless by the time it reaches a bench, too
 * short and a box bound for another district is late by the rules and not in
 * fact.
 *
 * 14 days is a stand-in chosen so the letter can name a date at all — an
 * instruction to deliver "in due course" is not an instruction. **It is
 * printed as guidance, not as an expiry**, and nothing in the system refuses a
 * box that arrives after it: a rule enforced on a number nobody has confirmed
 * would reject real samples over an invented deadline. When the CM Wing gives
 * the real period — and says whether it differs by discipline, which
 * microbiological work suggests it must — change it here, and add the
 * enforcement then and not before.
 */
export const SAMPLE_SUBMISSION_DAYS = 14;

export function sampleSubmissionDueOn(issuedAt: Date): Date {
  const d = new Date(issuedAt);
  d.setDate(d.getDate() + SAMPLE_SUBMISSION_DAYS);
  return d;
}
