import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { setProduction } from "@/lib/cm/practice";
import { productionSchema, parseOrThrow } from "@/lib/cm/schemas";

/** Step 3 — what the plant can make of this product, and what it made. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const applicationId = Number((await params).id);
  if (!Number.isInteger(applicationId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    // The same schema the form validates against, so the route can never be
    // laxer than the screen and the two can never drift apart.
    const input = parseOrThrow(productionSchema, body);
    const row = await setProduction(applicationId, input, userId);
    // Decimal does not survive JSON, so both figures cross as strings.
    return NextResponse.json({
      production: {
        ...row,
        annualCapacityValue: String(row.annualCapacityValue),
        currentYearProduction: String(row.currentYearProduction),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save the production details." },
      { status: 400 },
    );
  }
}
