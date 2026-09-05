import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { planFor } from "@/lib/cm/inspection";
import { launchBrowser } from "@/lib/pdf";

/**
 * The office order as a PDF (D85).
 *
 * Puppeteer renders the same page an officer sees at `/workflow/[id]/order` —
 * its toolbar is `print:hidden`, so there is no second layout to keep in step.
 * The salary slip's arrangement, for the same reason.
 *
 * Standing is checked *here* as well as on the page, before Chromium is
 * started: the page would refuse too, but launching a browser for a request
 * that is going to 404 is a needless way to spend a second.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const viewer = await requireInternal();
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = await planFor(applicationId);
  if (!plan?.approvedAt || !plan.orderNo) {
    return NextResponse.json({ error: "No approved office order" }, { status: 404 });
  }

  const url = new URL(req.url);
  const printUrl = `${url.protocol}//${url.host}/workflow/${applicationId}/order`;

  // Forward the caller's cookies so the rendered page is authenticated as them.
  const cookies = (req.headers.get("cookie") ?? "")
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
      margin: { top: "15mm", right: "20mm", bottom: "15mm", left: "20mm" },
    });

    // The order number carries slashes, which cannot go in a filename.
    const safe = plan.orderNo.replace(/[^A-Za-z0-9._-]+/g, "-");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="inspection-order-${safe}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
