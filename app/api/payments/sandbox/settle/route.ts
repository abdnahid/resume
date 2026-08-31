import { NextResponse } from "next/server";
import { sandboxSettle } from "@/lib/payments/sandbox";

/**
 * The payer's choice on the sandbox gateway's hosted page.
 *
 * This stands in for what happens **inside** the gateway — on SSLCommerz's
 * servers, not ours. It records the gateway's own outcome and nothing else; it
 * does not touch the `Payment` row. Settlement still requires our server to
 * come back and ask `verify()`, exactly as it will with a real gateway.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reference = typeof body.reference === "string" ? body.reference : "";
  const outcome = body.outcome;
  const method = typeof body.method === "string" ? body.method : null;

  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  if (outcome !== "paid" && outcome !== "failed" && outcome !== "cancelled")
    return NextResponse.json({ error: "Unknown outcome" }, { status: 400 });

  try {
    await sandboxSettle(reference, outcome, method);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sandbox error" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
