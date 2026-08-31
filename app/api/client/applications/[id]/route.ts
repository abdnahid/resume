import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { membershipFor } from "@/lib/cm/applications";
import { isEditable } from "@/lib/cm/states";

async function guard(applicationId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized", status: 401 as const };
  const m = await membershipFor(userId, applicationId);
  if (!m) return { error: "Not found", status: 404 as const };
  if (m.role === "viewer") return { error: "You do not have permission to edit this application.", status: 403 as const };
  return { userId };
}

const EDITABLE = ["productName", "brandName", "productDetails"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  if (!isEditable(app.state))
    return NextResponse.json(
      { error: "This application has been submitted and can no longer be edited." },
      { status: 409 },
    );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data: Record<string, string | null> = {};
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    const v = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    data[key] = v || null;
  }

  // Changing the factory would change which office receives the file, so it is
  // allowed only while the application is a draft nobody has been told about.
  if ("factoryId" in body) {
    const factoryId = Number(body.factoryId);
    const factory = await prisma.factory.findUnique({ where: { id: factoryId } });
    if (!factory || factory.organizationId !== app.organizationId)
      return NextResponse.json({ error: "That factory belongs to a different company." }, { status: 400 });
    await prisma.application.update({ where: { id }, data: { factoryId } });
  }

  if (Object.keys(data).length === 0 && !("factoryId" in body))
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const updated = Object.keys(data).length
    ? await prisma.application.update({ where: { id }, data: data as never })
    : await prisma.application.findUniqueOrThrow({ where: { id } });

  return NextResponse.json({ application: { id: updated.id } });
}
