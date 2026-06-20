import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AddressInput = {
  division?: string; district?: string; upazila?: string;
  cityCorpType?: string; cityCorpName?: string; ward?: string;
  houseNo?: string; road?: string; postOffice?: string;
  postCode?: string; thana?: string;
};

async function upsertAddress(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  existingId: number | null,
  data: AddressInput,
) {
  const payload = {
    division:     data.division     || null,
    district:     data.district     || null,
    upazila:      data.upazila      || null,
    cityCorpType: data.cityCorpType || null,
    cityCorpName: data.cityCorpName || null,
    ward:         data.ward         || null,
    houseNo:      data.houseNo      || null,
    road:         data.road         || null,
    postOffice:   data.postOffice   || null,
    postCode:     data.postCode     || null,
    thana:        data.thana        || null,
  };
  if (existingId) {
    await tx.address.update({ where: { id: existingId }, data: payload });
    return existingId;
  }
  const created = await tx.address.create({ data: payload });
  return created.id;
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const body = await req.json();
  const { present, permanent, sameAsPermanent } = body as {
    present: AddressInput;
    permanent: AddressInput;
    sameAsPermanent: boolean;
  };

  try {
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        select: { presentAddressId: true, permanentAddressId: true },
      });
      if (!employee) throw new Error("Employee not found");

      const presentId = await upsertAddress(tx, employee.presentAddressId, present);

      const permData = sameAsPermanent ? present : permanent;
      const permanentId = await upsertAddress(tx, employee.permanentAddressId, permData);

      await tx.employee.update({
        where: { id: employeeId },
        data: {
          presentAddressId:  presentId,
          permanentAddressId: permanentId,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
