import { NextResponse } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isValidMobile,
  normalizeMobile,
  placeholderEmail,
} from "@/lib/auth-identity";

/**
 * Tier-1 client registration (§2.1) — mobile and name, nothing more. Email is
 * optional; when it is absent the row carries a synthesised placeholder, because
 * better-auth 1.6.9 has no email-less sign-up path.
 *
 * Public by design. `middleware.ts` exempts `/api/client/*` from the internal
 * gate. `accountType` is never read from the request — the database hook in
 * `lib/auth.ts` forces CLIENT on everything better-auth creates.
 */
export async function POST(req: Request) {
  let body: {
    name?: string;
    mobile?: string;
    email?: string;
    password?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const mobile = normalizeMobile(body.mobile ?? "");
  const email = body.email?.trim().toLowerCase() || null;
  const password = body.password ?? "";

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Please enter your full name." },
      { status: 400 },
    );
  }
  if (!isValidMobile(mobile)) {
    return NextResponse.json(
      { error: "Enter a valid Bangladeshi mobile number, e.g. 01712345678." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address, or leave it blank." },
      { status: 400 },
    );
  }

  if (await prisma.user.findUnique({ where: { mobile }, select: { id: true } })) {
    return NextResponse.json(
      { error: "An account already exists for this mobile number." },
      { status: 409 },
    );
  }
  if (
    email &&
    (await prisma.user.findUnique({ where: { email }, select: { id: true } }))
  ) {
    return NextResponse.json(
      { error: "An account already exists for this email address." },
      { status: 409 },
    );
  }

  let created: { headers: Headers; userId: string };

  try {
    const result = await auth.api.signUpEmail({
      body: { name, email: email ?? placeholderEmail(mobile), password },
      returnHeaders: true,
    });
    created = { headers: result.headers, userId: result.response.user.id };
  } catch (err) {
    const message =
      err instanceof APIError
        ? (err.body?.message ?? "Could not create the account.")
        : "Could not create the account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  /**
   * The mobile number lands in a second write, so the unique index — not the
   * check above — is what actually decides a race between two registrations for
   * the same number. If it rejects us, the half-made account is removed rather
   * than left behind as an unreachable row.
   */
  try {
    await prisma.user.update({
      where: { id: created.userId },
      data: { mobile },
    });
  } catch {
    await prisma.user
      .delete({ where: { id: created.userId } })
      .catch(() => undefined);
    return NextResponse.json(
      { error: "An account already exists for this mobile number." },
      { status: 409 },
    );
  }

  // Forward better-auth's Set-Cookie so registration signs the client straight in.
  const response = NextResponse.json({ ok: true });
  created.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") response.headers.append(key, value);
  });
  return response;
}
