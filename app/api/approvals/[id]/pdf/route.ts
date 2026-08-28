import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { launchBrowser } from "@/lib/pdf";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "superadmin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Derive the base URL from the incoming request
  const reqUrl   = new URL(req.url);
  const baseUrl  = `${reqUrl.protocol}//${reqUrl.host}`;
  const printUrl = `${baseUrl}/print/${id}`;

  // Forward all cookies from the browser request so Puppeteer is authenticated
  const cookieHeader = req.headers.get("cookie") ?? "";
  const parsedCookies = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const eqIdx = c.indexOf("=");
      return {
        name:   c.slice(0, eqIdx).trim(),
        value:  c.slice(eqIdx + 1).trim(),
        domain: reqUrl.hostname,
        path:   "/",
      };
    })
    .filter((c) => c.name && c.value);

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    if (parsedCookies.length > 0) {
      await page.setCookie(...parsedCookies);
    }

    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format:          "Letter",
      printBackground: true,
      margin:          { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="profile-${id}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
