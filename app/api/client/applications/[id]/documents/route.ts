import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { membershipFor } from "@/lib/cm/applications";
import { CM_DOCUMENTS } from "@/lib/cm/policy";
import { isEditable } from "@/lib/cm/states";

/**
 * Record a document against the application.
 *
 * **The file is not stored** — the kernel document store does not exist yet, so
 * this records the declaration and the file name. Deliberately not a fake
 * upload: a progress bar that discards the bytes would leave an applicant
 * believing BSTI holds a document it does not have.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await membershipFor(userId, id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.role === "viewer")
    return NextResponse.json({ error: "You do not have permission to edit this application." }, { status: 403 });

  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  if (!isEditable(app.state))
    return NextResponse.json({ error: "This application can no longer be edited." }, { status: 409 });

  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

  const requirement = CM_DOCUMENTS.find((d) => d.kind === kind);
  if (!requirement) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "Choose a file." }, { status: 400 });

  // 10 MB. Checked even though the bytes are discarded, so the limit is not a
  // surprise on the day the document store lands.
  if (file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: "That file is larger than 10 MB." }, { status: 413 });

  const doc = await prisma.applicationDocument.upsert({
    where: { applicationId_kind: { applicationId: id, kind } },
    create: {
      applicationId: id,
      kind,
      label: requirement.label,
      fileName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
      uploadedBy: userId,
    },
    update: {
      fileName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
      uploadedBy: userId,
      uploadedAt: new Date(),
    },
  });

  return NextResponse.json({ document: { id: doc.id, kind: doc.kind, fileName: doc.fileName } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await membershipFor(userId, id);
  if (!m || m.role === "viewer")
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  await prisma.applicationDocument.deleteMany({ where: { applicationId: id, kind } });
  return NextResponse.json({ ok: true });
}
