import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resolvePayrollScope } from "@/lib/salary/payroll";
import { getPayslip } from "@/lib/salary/slip";
import { launchBrowser } from "@/lib/pdf";

/**
 * The salary slip as a PDF.
 *
 * Puppeteer renders the same page the browser shows — its toolbar is
 * `print:hidden`, so there is no second layout to keep in step.
 *
 * The caller's scope is checked *here* as well, before a browser is launched:
 * the page would refuse too, but starting Chromium for a request that is going
 * to 404 is a needless way to spend a second.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");
  if (!month || !year) {
    return NextResponse.json(
      { error: "month and year are required" },
      { status: 400 },
    );
  }

  const role = (session.user as { role?: string }).role ?? "employee";
  const username = session.user.username ?? "";

  let scope: { officeId?: number | null; employeeId?: string } | undefined;
  if (role === "officeadmin") {
    const s = await resolvePayrollScope(role, username);
    scope = { officeId: s?.officeId ?? -1 };
  } else if (role !== "superadmin") {
    scope = { employeeId: username };
  }

  const slip = await getPayslip(id, month, year, scope);
  if (!slip) {
    return NextResponse.json({ error: "Salary slip not found" }, { status: 404 });
  }

  const printUrl =
    `${url.protocol}//${url.host}/hr/listing/salary/slip/${encodeURIComponent(id)}` +
    `?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`;

  // Forward the caller's cookies so the rendered page is authenticated as them.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const eq = c.indexOf("=");
      return {
        name: c.slice(0, eq).trim(),
        value: c.slice(eq + 1).trim(),
        domain: url.hostname,
        path: "/",
      };
    })
    .filter((c) => c.name && c.value);

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    if (cookies.length) await page.setCookie(...cookies);
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" },
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="payslip-${id}-${month}-${year}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
