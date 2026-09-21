import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { addTitle } from "@/lib/job-titles";

/**
 * Add a title to the shared catalogue (D152). Superadmin only.
 *
 * **Returns the existing row rather than refusing** where one already matches
 * on `titleKey`: an administrator typing a title that is already there means
 * "use that one", and a duplicate-key error would be a refusal to do the
 * obvious thing.
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasRole(viewer, "superadmin"))
    return NextResponse.json({ error: "Only a superadmin can add a title." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await addTitle(
        typeof body.titleEn === "string" ? body.titleEn : "",
        typeof body.titleBn === "string" ? body.titleBn : null,
      ),
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
