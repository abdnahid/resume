import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createApplication } from "@/lib/cm/applications";
import { canApply } from "@/lib/client/organization";

/** Start a CM licence application against one factory. */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const organizationId = Number(body.organizationId);
  const factoryId = Number(body.factoryId);
  if (!Number.isInteger(organizationId) || !Number.isInteger(factoryId))
    return NextResponse.json({ error: "Choose a company and a factory." }, { status: 400 });

  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: { select: { type: true } } },
  });
  if (!membership) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (membership.role === "viewer")
    return NextResponse.json({ error: "You do not have permission to apply for this company." }, { status: 403 });

  // A mother organisation is administrative and never holds a licence (D29).
  if (!canApply(membership.organization.type)) {
    return NextResponse.json(
      { error: "A mother organisation cannot hold a licence. Apply from the company that owns the factory." },
      { status: 409 },
    );
  }

  try {
    const app = await createApplication({ organizationId, factoryId, userId });
    return NextResponse.json({ application: { id: app.id } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start the application." },
      { status: 400 },
    );
  }
}
