/**
 * The shape of every CM form payload, once.
 *
 * **The point is that the form and the route parse the same schema.** The UI is
 * never the enforcement point (§3.3), but until now the two sides validated
 * separately — `validateSku()` on one, hand-rolled `typeof body.x === "string"`
 * on the other — and two rules that must agree but are written twice eventually
 * disagree. A route that parses this cannot be laxer than the form, and a form
 * built from it cannot ask for something the route will reject.
 *
 * Prisma-free (D9): imported by client components and by route handlers.
 */
import { z } from "zod";
import { CAPACITY_AUTHORITIES, CM_QUESTIONS, LABEL_IMAGE_MAX_BYTES, LABEL_IMAGE_MIMES } from "./policy";

/**
 * A number that arrives from an `<input>`, so it may be a string, and an empty
 * one means "not given" rather than zero. `z.coerce.number()` turns "" into 0,
 * which would silently accept a blank capacity as a real figure.
 */
const numeric = (message: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ error: message }).refine((n) => Number.isFinite(n), { message }),
  );

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const AUTHORITY_VALUES = CAPACITY_AUTHORITIES.map((a) => a.value) as [string, ...string[]];

/** Step 3 — production capacity. */
export const productionSchema = z
  .object({
    authority: z.enum(AUTHORITY_VALUES, { error: "Choose who approved the capacity." }),
    registrationNo: optionalText,
    annualCapacityValue: numeric("Give the approved annual capacity.").pipe(
      z.number().positive("Annual capacity must be more than zero."),
    ),
    capacityUnitId: numeric("Choose the unit.").pipe(z.number().int()),
    currentYearLabel: z.string().trim().min(1, "Which year are these figures for?"),
    currentYearProduction: numeric("Give this year's production.").pipe(
      z.number().min(0, "This year's production cannot be negative."),
    ),
  })
  .refine((v) => v.currentYearProduction <= v.annualCapacityValue, {
    // Not a typo-catcher: producing above approved capacity is exactly what a
    // licence review exists to notice, so it is refused rather than flagged.
    path: ["currentYearProduction"],
    message:
      "More than the approved annual capacity. A plant cannot be licensed to make more than it is approved for.",
  })
  .refine((v) => v.authority === "other" || !!v.registrationNo, {
    path: ["registrationNo"],
    message: "Give the registration or approval number the capacity is quoted from.",
  });

export type ProductionValues = z.input<typeof productionSchema>;

/**
 * Step 4 — the answers, built from the question catalogue rather than listed.
 *
 * `CM_QUESTIONS` is an `[ASSUMPTION]` that will change; deriving the schema from
 * it means adding a question is one entry in the catalogue and nothing here.
 */
export const answersSchema = z.object(
  Object.fromEntries(
    CM_QUESTIONS.flatMap((g) =>
      g.questions.map((q) => {
        if (q.type === "number") {
          const base = numeric(`${q.labelEn} is needed.`).pipe(
            z.number().int().min(0, "Cannot be negative."),
          );
          return [q.key, q.required ? base : base.optional()] as const;
        }
        const base = z.string().trim();
        return [
          q.key,
          q.required ? base.min(1, "This answer is needed.") : base.optional(),
        ] as const;
      }),
    ),
  ),
);

/** The declaration rides with the answers but is its own claim (D55). */
export const consentSchema = z.object({ consent: z.boolean() });

/** Step 2 — one article. */
export function skuSchema(sizeKind: "numeric" | "categorical") {
  return z.object({
    brandName: z.string().trim().min(1, "Give the brand this article is sold under."),
    variant: optionalText,
    sizeTypeId: numeric("Choose how this size is measured.").pipe(z.number().int()),
    sizeUnitId: numeric("Choose the unit.").pipe(z.number().int()),
    sizeValue:
      sizeKind === "numeric"
        ? numeric("Give the size.").pipe(z.number().positive("Size must be more than zero."))
        : z
            .any()
            .refine((v) => v === "" || v === null || v === undefined, {
              // "Shirt size M × 3" is not a size — the unit is the whole answer.
              message: "This size type carries no number.",
            })
            .optional(),
    packaging: optionalText,
    unitsPerPack: numeric("Units per pack must be a number.")
      .pipe(z.number().int().positive("Units per pack must be more than zero."))
      .optional(),
    grade: optionalText,
    labelImageName: optionalText,
    labelImageSizeBytes: z
      .number()
      .max(LABEL_IMAGE_MAX_BYTES, "The label must be 8 MB or smaller.")
      .nullable()
      .optional(),
    labelImageMime: z
      .string()
      .refine((v) => !v || LABEL_IMAGE_MIMES.includes(v as never), {
        message: "The label must be a JPEG, PNG, WebP or PDF.",
      })
      .nullable()
      .optional(),
  });
}

/**
 * Parse on the server and turn a failure into the one-line message the routes
 * already return, so adopting a schema does not change how errors read.
 */
export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(first?.message ?? "That does not look right.");
  }
  return result.data;
}
