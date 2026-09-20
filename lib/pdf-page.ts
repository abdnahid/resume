/**
 * Print one of our own pages to a PDF.
 *
 * **The screen and the PDF are the same page** — the arrangement every document
 * in the system uses, from the salary slip to the office order: the toolbar is
 * `print:hidden` and Puppeteer loads the URL a desk already reads, so there is
 * no second layout to keep in step.
 *
 * This is that mechanism, once. It was copied per route — the office order, the
 * sampling letter, the internal letter, the test report — and every copy
 * repeats the same cookie-forwarding loop, the same A4 margins and the same
 * `networkidle0`. A fifth copy is where they start to disagree about the
 * margin.
 *
 * **Cookies are forwarded so the rendered page is authenticated as the
 * caller.** That is also why every caller must re-check access *before* calling
 * this: the page would refuse on its own, but a browser launched for a request
 * that is going to 404 is a second spent for nothing.
 */
import { NextResponse } from "next/server";
import { launchBrowser } from "@/lib/pdf";

export async function pdfFromPage(
  req: Request,
  opts: { path: string; filename: string },
): Promise<NextResponse> {
  const url = new URL(req.url);
  const printUrl = `${url.protocol}//${url.host}${opts.path}`;

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

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${opts.filename}"`,
      },
    });
  } finally {
    await browser.close();
  }
}
