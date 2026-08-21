import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getBankAdviceById, getBankAdviceEntries, ORG } from "@/lib/db";
import BankAdviceDocument from "../BankAdviceDocument";

export default async function BankAdviceDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const numId = Number(params.id);
  if (isNaN(numId)) notFound();

  const advice = await getBankAdviceById(numId);
  if (!advice) notFound();

  const entries = await getBankAdviceEntries(advice.month, advice.year);

  return (
    <div>
      <BankAdviceDocument advice={advice} entries={entries} org={ORG} />
    </div>
  );
}
