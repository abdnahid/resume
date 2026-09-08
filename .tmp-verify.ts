import "dotenv/config";
import { prisma } from "./lib/prisma";
import { testFeeFor } from "./lib/cm/sub-products";

async function main() {
  for (const serial of [248, 261, 262]) {
    const p = await prisma.product.findFirstOrThrow({
      where: { serial },
      select: { serial: true, nameEn: true, subProducts: {
        select: { id: true, nameEn: true,
          parameters: { select: { nameEn: true, sourceSection: true, discipline: true, feePoisha: true, urgentFeePoisha: true } },
          packageFees: { select: { sourceSection: true } } },
        orderBy: { id: "asc" } } },
    });
    console.log(`\n#${p.serial} ${p.nameEn} — ${p.subProducts.length} sub-product(s)`);
    for (const sp of p.subProducts) {
      const secs = [...new Set(sp.parameters.map(x => x.sourceSection))].sort();
      const disc = [...new Set(sp.parameters.map(x => x.discipline))].sort();
      const n = sp.parameters.reduce((a,x)=>a+x.feePoisha,0), u = sp.parameters.reduce((a,x)=>a+x.urgentFeePoisha,0);
      console.log(`  "${sp.nameEn}"`);
      console.log(`     ${sp.parameters.length} tests · sections ${secs.join("+")} · disciplines ${disc.join("+")} · fee ৳${n/100} → ৳${u/100} · package rows ${sp.packageFees.length}`);
    }
  }

  const app = await prisma.applicationSubProduct.findFirst({
    where: { applicationId: 24 },
    select: { subProduct: { select: { id: true, nameEn: true,
      parameters: { select: { sourceSection: true } } } } },
  });
  console.log(`\nDraft application 24 now points at [${app!.subProduct.id}] "${app!.subProduct.nameEn}"`);
  console.log(`   which carries ${app!.subProduct.parameters.length} tests from ${[...new Set(app!.subProduct.parameters.map(x=>x.sourceSection))].join("+")}`);
  const fee = await testFeeFor(24);
  console.log(`   test fee for that draft: ৳${fee.totalPoisha/100}  (${fee.lines.map(l=>`${l.subProduct} ৳${l.poisha/100}`).join(", ")})`);

  const totals = {
    parameters: await prisma.testParameter.count(),
    subProducts: await prisma.subProduct.count(),
    capability: await prisma.labCapability.count(),
    routing: await prisma.labRouting.count(),
    orphanParams: await prisma.testParameter.count({ where: { capabilities: { none: {} } } }),
    orphanRouting: await prisma.testParameter.count({ where: { routings: { none: {} } } }),
    nullUrgent: await prisma.testParameter.count({ where: { urgentFeePoisha: undefined } }),
  };
  console.log(`\n${JSON.stringify(totals, null, 0)}`);
  // Every product still reachable from one wing only?
  const multi = await prisma.$queryRaw<{n: bigint}[]>`
    SELECT COUNT(*) n FROM (
      SELECT sp."productId"
        FROM "SubProduct" sp JOIN "TestParameter" tp ON tp."subProductId" = sp.id
       GROUP BY sp."productId", sp.id
      HAVING COUNT(DISTINCT tp."sourceSection") > 1) x`;
  console.log(`sub-products now carrying more than one wing's tests: ${Number(multi[0].n)}`);
  await prisma.$disconnect();
}
main();
