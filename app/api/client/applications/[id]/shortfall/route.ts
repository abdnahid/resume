import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { membershipFor } from "@/lib/cm/applications";
import { respondToShortfall } from "@/lib/cm/shortfall";

/**
 * The applicant answers a correction request (D81).
 *
 * Client-facing, so it sits under `/api/client` — one of the four prefixes in
 * `PUBLIC_API_PREFIXES`. A viewer may not respond: answering a shortfall is a
 * statement on the company's behalf.
 *
 * Nothing here checks that the marked points were actually corrected. That
 * judgement belongs to the officer, which is why the file goes back to him to
 * look again rather than the system deciding it has been satisfied.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await membershipFor(userId, id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.role === "viewer")
    return NextResponse.json({ error: "You do not have permission to respond." }, { status: 403 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // A response with no covering note is fine — the corrections are the answer.
  }

  try {
    await respondToShortfall({
      applicationId: id,
      userId,
      response: typeof body.response === "string" ? body.response : null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send the response." },
      { status: 409 },
    );
  }
}
