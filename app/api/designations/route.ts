import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { renameDesignation } from "@/lib/designation-service";

/**
 * Rename a designation across its holders, or merge one variant into another.
 * Superadmin only.
 *
 * Body: `{ from, toEn, toBn?, employeeIds? }`. A merge and a rename are the
 * same write — merging *পরীক্ষক* into *Examiner* is renaming it to a string
 * somebody else already holds — so there is one route rather than two that
 * would have to agree.
 *
 * The rules live in `renameDesignation()`, because a rule enforced only where
 * the button is holds only for people who used the button.
 */
export async function PATCH(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json(
      { error: "Only a superadmin can change designations." },
      { status: 403 },
    );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const from = typeof body.from === "string" ? body.from : "";
  const toEn = typeof body.toEn === "string" ? body.toEn : "";
  const toBn = typeof body.toBn === "string" ? body.toBn : undefined;
  const ids = Array.isArray(body.employeeIds)
    ? body.employeeIds.filter((x): x is string => typeof x === "string")
    : undefined;

  try {
    return NextResponse.json(
      await renameDesignation({ from, toEn, toBn, employeeIds: ids }),
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
