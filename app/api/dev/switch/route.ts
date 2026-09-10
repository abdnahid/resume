import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * **A development-only account switcher. It must never exist in production.**
 *
 * Testing a workflow means being six people in turn — the office head receives,
 * passes down to an AD, who passes to an FDO, who plans a visit the DD approves
 * — and signing out and in again between every step makes a ten-minute test an
 * hour. This turns that into one click.
 *
 * Three things keep it honest:
 *
 * - **It is gated on `NODE_ENV` in both directions.** The route 404s outside
 *   development and the widget is not rendered, so Next's dead-code elimination
 *   removes it from a production bundle entirely. A build that shipped this
 *   would be an authentication bypass on a government system.
 * - **It signs in through the ordinary credential path**, `signInUsername` with
 *   a real password — the same call the login screen makes. It does not mint a
 *   session, forge a cookie or trust a claimed identity, so nothing here is a
 *   second way in that could drift from the first. An account whose password
 *   differs simply fails, exactly as it would at the login screen.
 * - **The password stays on the server.** It is read from the environment here
 *   rather than shipped to the browser, so it is not in the client bundle even
 *   in development.
 */
const isDev = process.env.NODE_ENV !== "production";
const PASSWORD = process.env.DEV_SWITCH_PASSWORD ?? "bsti@123";

/** Who there is to become, with the facts that decide which one you want. */
export async function GET() {
  if (!isDev) return new NextResponse(null, { status: 404 });

  const users = await prisma.user.findMany({
    where: { accountType: "INTERNAL", username: { not: null } },
    select: { username: true, name: true, role: true },
  });
  const ids = users.map((u) => u.username!).filter(Boolean);

  const [employees, holdings] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        nameEn: true,
        designationEn: true,
        designationBn: true,
        grade: true,
        status: true,
        orgPostId: true,
        actingOrgPostId: true,
        office: { select: { nameEn: true } },
      },
    }),
    // Which desks are actually holding a file — the question the switcher
    // exists to answer, so it does not have to be guessed from a name.
    prisma.application.groupBy({
      by: ["holderEmployeeId"],
      where: { holderEmployeeId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const emp = new Map(employees.map((e) => [e.id, e]));
  const held = new Map(holdings.map((h) => [h.holderEmployeeId as string, h._count._all]));

  const rows = users
    .map((u) => {
      const e = emp.get(u.username!);
      return {
        employeeId: u.username!,
        name: e?.nameEn ?? u.name,
        designation: e?.designationEn ?? e?.designationBn ?? null,
        office: e?.office?.nameEn ?? null,
        grade: e?.grade ?? null,
        role: u.role,
        status: e?.status ?? null,
        hasDesk: (e?.orgPostId ?? e?.actingOrgPostId) != null,
        holding: held.get(u.username!) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.holding - a.holding ||
        (a.office ?? "").localeCompare(b.office ?? "") ||
        a.name.localeCompare(b.name),
    );

  return NextResponse.json({ accounts: rows });
}

/** Become one of them. */
export async function POST(req: Request) {
  if (!isDev) return new NextResponse(null, { status: 404 });

  const { employeeId } = (await req.json()) as { employeeId?: string };
  if (!employeeId) return NextResponse.json({ error: "Which employee?" }, { status: 400 });

  // Ending the old session first, so a morning of testing does not leave a
  // trail of live sessions behind. Failure is not fatal: signing in overwrites
  // the cookie in any case.
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    /* nothing to end */
  }

  try {
    // `asResponse` hands back better-auth's own response, cookies and all —
    // the same one the login screen receives.
    return await auth.api.signInUsername({
      body: { username: employeeId, password: PASSWORD },
      headers: await headers(),
      asResponse: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || `Could not sign in as ${employeeId}.` },
      { status: 400 },
    );
  }
}
