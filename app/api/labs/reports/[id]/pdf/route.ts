import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { canViewOrder } from "@/lib/labs/board";
import { labActorFor } from "@/lib/labs/testing";
import { reportDocument } from "@/lib/labs/report-document";
import { launchBrowser } from "@/lib/pdf";

/**
 * A test report as a PDF (D145).
 *
 * Puppeteer renders the same page every desk reads at
 * `/workflow/work-order/[id]/report` — its toolbar is `print:hidden`, so there
 * is no second layout to keep in step. The sampling letter's arrangement, for
 * the same reason.
 *
 * **A draft prints too**, and carries its watermark. The officer sending it up
 * is entitled to the same document the approver will see.
 *
 * Access is re-checked here before Chromium starts: the page would refuse too,
 * but launching a browser for a request that is going to 404 is a needless way
 * to spend a second.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const viewer = await requireInternal();
  const actor = labActorFor(await actorFor(viewer));
  if (!(await canViewOrder(actor, orderId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await reportDocument(orderId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const printUrl = `${url.protocol}//${url.host}/workflow/work-order/${orderId}/report`;

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
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });

    const safe = (order.report?.reportNo ?? order.code).replace(/[^A-Za-z0-9._-]+/g, "-");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="test-report-${safe}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
