/**
 * Shared logic for the salary head catalogue routes.
 *
 * Lives here rather than in `app/api/salary/heads/route.ts` because a Next
 * route module may only export route handlers and a fixed set of config names —
 * exporting a helper from one makes the generated route-type validator fail
 * with "Property 'x' is incompatible with index signature".
 *
 * Server-only: imports `auth`, and through it Prisma.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const KINDS = ["earning", "deduction"] as const;
export const BASES = ["fixed", "percent_of_basic", "house_rent_rule"] as const;

type Kind = (typeof KINDS)[number];
type Basis = (typeof BASES)[number];

export type HeadGate =
  | { ok: false; response: NextResponse }
  | { ok: true; username: string };

/**
 * Heads are global policy: a head created here is offered to every office, so
 * unlike fixation itself (which an officeadmin may set for their own staff)
 * managing the catalogue is superadmin only. An officeadmin who could invent
 * allowances could raise their own office's pay.
 */
export async function requireSuperadmin(): Promise<HeadGate> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    (session.user as { accountType?: string }).accountType !== "INTERNAL"
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  if ((session.user as { role?: string }).role !== "superadmin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only a superadmin can change the salary head catalogue." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, username: session.user.username ?? "" };
}

/**
 * Validate a head payload. `code` is only required on create — it is the
 * natural key that saved fixation lines are read back through, and is not
 * editable afterwards.
 */
export function parseHeadBody(
  body: Record<string, unknown>,
  { requireCode }: { requireCode: boolean },
):
  | { ok: false; error: string }
  | {
      ok: true;
      data: {
        code?: string;
        nameEn: string;
        nameBn: string;
        kind: Kind;
        basis: Basis;
        defaultValue: number | null;
        isDefault: boolean;
        isActive: boolean;
        sortOrder: number;
        note: string | null;
      };
    } {
  const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim() : "";
  const nameBn = typeof body.nameBn === "string" ? body.nameBn.trim() : "";
  if (!nameEn) return { ok: false, error: "An English name is required." };
  if (!nameBn) return { ok: false, error: "A Bengali name is required." };

  const kind = body.kind as Kind;
  if (!KINDS.includes(kind)) {
    return { ok: false, error: "Kind must be earning or deduction." };
  }

  const basis = body.basis as Basis;
  if (!BASES.includes(basis)) {
    return {
      ok: false,
      error:
        "Basis must be a fixed amount, a percentage of basic, or the house rent rule.",
    };
  }

  let defaultValue: number | null = null;
  if (basis !== "house_rent_rule") {
    if (
      body.defaultValue === null ||
      body.defaultValue === undefined ||
      body.defaultValue === ""
    ) {
      defaultValue = null;
    } else {
      const v = Number(body.defaultValue);
      if (!Number.isFinite(v) || v < 0) {
        return { ok: false, error: "The default value cannot be negative." };
      }
      if (basis === "percent_of_basic" && v > 100) {
        return { ok: false, error: "A percentage of basic cannot exceed 100." };
      }
      defaultValue = Math.round(v);
    }
  }

  let code: string | undefined;
  if (requireCode) {
    const raw =
      typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(raw)) {
      return {
        ok: false,
        error:
          "Code must be 2–32 characters, start with a letter, and use only letters, digits and underscores.",
      };
    }
    code = raw;
  }

  const sortOrder = Number(body.sortOrder);

  return {
    ok: true,
    data: {
      ...(code ? { code } : {}),
      nameEn,
      nameBn,
      kind,
      basis,
      defaultValue,
      isDefault: body.isDefault === true,
      isActive: body.isActive !== false,
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
      note:
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim()
          : null,
    },
  };
}
