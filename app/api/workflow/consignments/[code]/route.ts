import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasAnyRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { submitConsignment } from "@/lib/samples/service";
import { syncLabState } from "@/lib/cm/lab-progress";

/**
 * The One Stop counter takes a box in (D93).
 *
 * `submitConsignment()` has existed since the sampling flow landed and had no
 * caller, so every sealed box in the system was uncollectable. The rules are
 * all in the service — the testing fee must be paid, the box must belong to
 * this office, a broken seal is a rejection and not a note — and this only
 * decides who may ask.
 *
 * **Scoped to the counter's own office**, taken from the viewer's employment
 * and never from the request: a counter that could name another office's id
 * could receive a box walking through somebody else's door.
 */
export async function POST(req: Request, context: { params: Promise<{ code: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasAnyRole(viewer, "one_stop", "superadmin"))
    return NextResponse.json(
      { error: "Only the One Stop counter may receive a sample." },
      { status: 403 },
    );
  if (!viewer.employeeId)
    return NextResponse.json({ error: "No employee record." }, { status: 403 });

  const me = await prisma.employee.findUnique({
    where: { id: viewer.employeeId },
    select: { officeId: true },
  });
  if (!me) return NextResponse.json({ error: "No employee record." }, { status: 403 });

  const { code } = await context.params;
  let body: { sealIntact?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // **Not defaulted.** "Was the seal intact" is the counter's whole job, and a
  // default would answer it for them — in the direction that accepts the box.
  if (typeof body.sealIntact !== "boolean")
    return NextResponse.json({ error: "Say whether the seal was intact." }, { status: 400 });

  try {
    const result = await submitConsignment({
      code,
      officeId: me.officeId,
      userId: viewer.id,
      sealIntact: body.sealIntact,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined,
    });

    // The file's own state follows from its boxes; `submitConsignment()` sets
    // `sample_received`, and this carries it on into testing where the wing has
    // already started. Failing here must not un-receive a box that is now
    // physically on the counter.
    const c = await prisma.consignment.findUnique({
      where: { code },
      select: { applicationId: true },
    });
    if (c) await syncLabState(c.applicationId).catch(() => null);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
