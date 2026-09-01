import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { saveAnswers, setConsent } from "@/lib/cm/practice";

/**
 * Step 4 — BSTI's questions, and the declaration.
 *
 * PATCH takes whatever subset the form holds, so a partly-answered step
 * survives a navigation. These are long answers, and losing them would be its
 * own reason not to finish the form.
 *
 * The declaration rides on the same request but is its own field, because it is
 * a different kind of statement: saving an answer is a draft, accepting the
 * declaration is a claim about the answers above it.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    // Answers first: the declaration says the answers are true, so it must
    // never be recorded against a version of them that failed to save.
    const answers =
      body.answers && typeof body.answers === "object"
        ? await saveAnswers(applicationId, body.answers as Record<string, unknown>, userId)
        : [];
    if ("consent" in body) {
      await setConsent(applicationId, body.consent === true, userId);
    }
    return NextResponse.json({ answers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save your answers." },
      { status: 400 },
    );
  }
}
