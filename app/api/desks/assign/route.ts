import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { setDesk } from "@/lib/desk-service";

/**
 * Apply a reviewed batch of desk placements. Superadmin only.
 *
 * Body: `{ placements: [{ employeeId, orgPostId }] }`.
 *
 * **Every placement goes through `setDesk()`**, one at a time, exactly as the
 * per-person picker does. A batch with its own write path would be a second set
 * of rules free to disagree with the first — and those rules are not
 * decoration: a post outside the employee's own office subtree makes them
 * unreachable by that office's routing, and confirming a seat is what clears
 * `orgPostIsInferred` (D131).
 *
 * **Partial success is reported, never rolled back.** Forty good placements
 * should not be undone because the forty-first hit a post that filled up while
 * the administrator was reading the list; each row reports its own outcome and
 * the ones that failed stay on the screen with their reason.
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json(
      { error: "Only a superadmin can change desk assignments." },
      { status: 403 },
    );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = Array.isArray(body.placements) ? body.placements : [];
  const placements = raw
    .map((p) => p as { employeeId?: unknown; orgPostId?: unknown })
    .filter((p) => typeof p.employeeId === "string" && Number.isInteger(Number(p.orgPostId)))
    .map((p) => ({ employeeId: p.employeeId as string, orgPostId: Number(p.orgPostId) }));

  if (!placements.length)
    return NextResponse.json({ error: "No placements to apply." }, { status: 400 });

  const applied: { employeeId: string; name: string; post: string }[] = [];
  const failed: { employeeId: string; error: string }[] = [];

  for (const p of placements) {
    try {
      const r = await setDesk({ employeeId: p.employeeId, orgPostId: p.orgPostId });
      applied.push({
        employeeId: r.employeeId,
        name: r.name,
        post: r.post ? `${r.post.nameEn} · ${r.post.unitEn}` : "—",
      });
    } catch (e) {
      failed.push({ employeeId: p.employeeId, error: (e as Error).message });
    }
  }

  return NextResponse.json({ applied, failed, total: placements.length });
}
