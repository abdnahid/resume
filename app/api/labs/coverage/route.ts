import { NextResponse } from "next/server";
import { labActor } from "../_actor";
import { canEditCoverage } from "@/lib/labs/access";
import {
  setPackageCoverage, setProductScope, setSubProductScope,
} from "@/lib/labs/coverage";

/**
 * The coverage form's three writes, behind one gate.
 *
 * One route rather than three, because they are three steps of one act and all
 * three answer to the same question: is this your office? Splitting them would
 * mean writing that check three times.
 */
export async function POST(req: Request) {
  const actor = await labActor();
  const body = (await req.json()) as Record<string, unknown>;

  const officeId = Number(body.officeId);
  if (!Number.isInteger(officeId))
    return NextResponse.json({ error: "Which office?" }, { status: 400 });
  if (!canEditCoverage(actor, officeId))
    return NextResponse.json(
      { error: "Only this office can say what it is able to test." },
      { status: 403 },
    );

  const ints = (v: unknown) =>
    Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : [];

  try {
    switch (body.step) {
      case "products":
        await setProductScope({
          officeId, add: ints(body.add), remove: ints(body.remove),
          employeeId: actor.employeeId,
        });
        return NextResponse.json({ ok: true });

      case "sub-product":
        await setSubProductScope({
          officeId,
          subProductId: Number(body.subProductId),
          selected: body.selected !== false,
          employeeId: actor.employeeId,
        });
        return NextResponse.json({ ok: true });

      case "package": {
        // Only what the office covers: what it runs itself, and what it sends
        // out and enters the result for. Everything else is *not covered*, and
        // that is said by the absence of a row (D116) — there is no destination
        // to record any more.
        const r = await setPackageCoverage({
          officeId,
          subProductId: Number(body.subProductId),
          inHouse: ints(body.inHouse),
          thirdParty: ints(body.thirdParty),
          employeeId: actor.employeeId,
        });
        return NextResponse.json({ ok: true, ...r });
      }

      default:
        return NextResponse.json({ error: "Unknown step." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
