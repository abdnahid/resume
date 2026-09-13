import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { setDesk } from "@/lib/desk-service";

/**
 * Seat an employee on an organogram post, or release them. Superadmin only.
 *
 * The `[id]` is the **employee id**, matching `/api/roles/[id]` — that is what
 * an administrator knows and what every other screen is keyed on.
 *
 * Body: `{ orgPostId?, actingOrgPostId?, allowOverfill? }`. A field that is
 * **absent** is left alone; an explicit `null` releases it. That distinction is
 * what lets the additional charge be ended without disturbing the substantive
 * seat, and vice versa (D74).
 *
 * The rules live in `setDesk()` rather than here, because a rule enforced only
 * where the button is holds only for people who used the button.
 */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json(
      { error: "Only a superadmin can change a desk assignment." },
      { status: 403 },
    );

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // `undefined` and `null` mean different things here, so the key's presence is
  // what is tested — not its truthiness.
  const read = (key: string): number | null | undefined => {
    if (!(key in body)) return undefined;
    const v = body[key];
    if (v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${key} must be a post id.`);
    return n;
  };

  try {
    const result = await setDesk({
      employeeId: id,
      orgPostId: read("orgPostId"),
      actingOrgPostId: read("actingOrgPostId"),
      allowOverfill: body.allowOverfill === true,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = (e as Error).message;
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("No such") ? 404 : 409 },
    );
  }
}
