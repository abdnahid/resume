import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePayrollScope } from "@/lib/salary/payroll";
import { HOUSE_RENT_ZONES, type HouseRentZone } from "@/lib/salary/compute";

/**
 * Office setup — contact details and the bank the office draws salary on.
 *
 * A superadmin may edit any office; an officeadmin only their own. Everyone
 * else is refused, including the case officer: this decides what a bank letter
 * says and where house rent lands.
 */

/**
 * The house rent zone is **superadmin only**, even on an officeadmin's own
 * office. It multiplies every salary in that office — moving an office into the
 * Dhaka zone would raise house rent from 40% to 50% of basic for all its staff,
 * which is not a change the office being paid should make for itself.
 */
async function gate(officeId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    (session.user as { accountType?: string }).accountType !== "INTERNAL"
  ) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const role = (session.user as { role?: string }).role ?? "employee";
  const username = session.user.username ?? "";
  const scope = await resolvePayrollScope(role, username);
  if (!scope) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Only an administrator can change office setup." },
        { status: 403 },
      ),
    };
  }
  if (scope.officeId !== null && scope.officeId !== officeId) {
    // 404 rather than 403 — an officeadmin learns nothing about other offices.
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Office not found" }, { status: 404 }),
    };
  }
  return { ok: true as const, role, username, isSuperadmin: role === "superadmin" };
}

function trimmed(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const officeId = Number(id);
  if (!Number.isInteger(officeId)) {
    return NextResponse.json({ error: "Invalid office id" }, { status: 400 });
  }

  const g = await gate(officeId);
  if (!g.ok) return g.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const office = await prisma.office.findUnique({
    where: { id: officeId },
    include: { bankAccount: true },
  });
  if (!office) {
    return NextResponse.json({ error: "Office not found" }, { status: 404 });
  }

  // ── Contact details ──
  const addressEn = trimmed(body.addressEn) || office.addressEn;
  const addressBn = trimmed(body.addressBn) || office.addressBn;
  const officeHead = trimmed(body.officeHead) || office.officeHead;
  const phone = trimmed(body.phone) || null;
  const email = trimmed(body.email) || null;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That is not a valid email address." }, { status: 400 });
  }

  // ── House rent zone: superadmin only ──
  let houseRentZone: HouseRentZone | null | undefined;
  if (body.houseRentZone !== undefined) {
    if (!g.isSuperadmin) {
      return NextResponse.json(
        {
          error:
            "Only a superadmin can change an office's house rent zone — it changes every salary in the office.",
        },
        { status: 403 },
      );
    }
    const z = body.houseRentZone;
    if (z === null || z === "") {
      houseRentZone = null;
    } else if (HOUSE_RENT_ZONES.includes(z as HouseRentZone)) {
      houseRentZone = z as HouseRentZone;
    } else {
      return NextResponse.json({ error: "Unknown house rent zone." }, { status: 400 });
    }
  }

  // ── Bank account ──
  const bank = body.bank as Record<string, unknown> | undefined;
  let bankData:
    | {
        bankId: number;
        recipientDesignationBn: string;
        branchNameBn: string;
        branchAddressBn: string;
        accountNo: string;
      }
    | null = null;

  if (bank) {
    const bankId = Number(bank.bankId);
    if (!Number.isInteger(bankId)) {
      return NextResponse.json({ error: "Choose a bank." }, { status: 400 });
    }
    const exists = await prisma.bank.findUnique({ where: { id: bankId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "That bank does not exist." }, { status: 400 });

    const recipientDesignationBn = trimmed(bank.recipientDesignationBn);
    const branchNameBn = trimmed(bank.branchNameBn);
    const branchAddressBn = trimmed(bank.branchAddressBn);
    const accountNo = trimmed(bank.accountNo);

    if (!recipientDesignationBn) {
      return NextResponse.json(
        { error: "Say who the letter is addressed to at the branch." },
        { status: 400 },
      );
    }
    if (!branchNameBn) return NextResponse.json({ error: "A branch name is required." }, { status: 400 });
    if (!branchAddressBn) return NextResponse.json({ error: "A branch address is required." }, { status: 400 });
    if (!accountNo) return NextResponse.json({ error: "An account number is required." }, { status: 400 });

    bankData = { bankId, recipientDesignationBn, branchNameBn, branchAddressBn, accountNo };
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.office.update({
      where: { id: officeId },
      data: {
        addressEn,
        addressBn,
        officeHead,
        phone,
        email,
        ...(houseRentZone !== undefined ? { houseRentZone } : {}),
      },
    });

    if (bankData) {
      await tx.officeBankAccount.upsert({
        where: { officeId },
        // Editing the details is the act of confirming them, so the improvised
        // flag clears itself rather than needing a separate tick.
        update: { ...bankData, isPlaceholder: false, updatedBy: g.username || null },
        create: { officeId, ...bankData, isPlaceholder: false, updatedBy: g.username || null },
      });
    }

    return tx.office.findUnique({
      where: { id: officeId },
      include: { bankAccount: { include: { bank: true } } },
    });
  });

  return NextResponse.json({ office: updated });
}
