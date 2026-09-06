import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { reportFor } from "@/lib/cm/inspection-report";
import { launchBrowser } from "@/lib/pdf";

/**
 * The sampling report as a PDF (D96) — the inspection report's arrangement,
 * over the same page the officer sees.
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

  const report = await reportFor(applicationId);
  if (!report || !(report.submittedAt || report.approvedAt)) {
    return NextResponse.json({ error: "No sampling report" }, { status: 404 });
  }

  const url = new URL(req.url);
  const printUrl = `${url.protocol}//${url.host}/workflow/${applicationId}/sampling-report`;

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

    const safe = (report.reportNo ?? `draft-${applicationId}`).replace(/[^A-Za-z0-9._-]+/g, "-");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sampling-report-${safe}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
