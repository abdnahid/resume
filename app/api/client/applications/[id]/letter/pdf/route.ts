import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { membershipFor } from "@/lib/cm/applications";
import { applicantLetterFor } from "@/lib/cm/letter-view";
import { launchBrowser } from "@/lib/pdf";

/**
 * The applicant's sample submission letter as a PDF (D98).
 *
 * Under `/api/client` because the person downloading it is a client — the
 * prefix is on the public allow-list, and the route enforces its own rule the
 * way every other client endpoint does: a session, then **membership** of this
 * application. A `viewer` is not refused, unlike the editing routes — reading a
 * letter is not writing to the file.
 *
 * Puppeteer renders `/public/applications/[id]/letter`, whose toolbar is
 * `print:hidden` — the same arrangement as the office order and the salary
 * slip, so there is no second layout to keep in step.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 401/404 rather than a redirect: this is an API route, and a redirect to
  // the login page arrives as an HTML body labelled `application/pdf`.
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await membershipFor(userId, applicationId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const letter = await applicantLetterFor(applicationId);
  if (!letter) {
    return NextResponse.json({ error: "No letter has been issued" }, { status: 404 });
  }

  const url = new URL(req.url);
  const printUrl = `${url.protocol}//${url.host}/public/applications/${applicationId}/letter`;

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

    // The memo number carries slashes and Bengali digits, neither of which
    // belongs in a filename.
    const safe = letter.letterNo.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sample-submission-${safe || applicationId}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
