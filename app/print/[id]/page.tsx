import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmployeeRecord } from "@/lib/db";

import GovHeader             from "@/components/GovHeader";
import DocumentTitle         from "@/components/DocumentTitle";
import PersonalSection       from "@/components/PersonalSection";
import CurrentJobSection     from "@/components/CurrentJobSection";
import AddressSection        from "@/components/AddressSection";
import EducationSection      from "@/components/EducationSection";
import PostingSection        from "@/components/PostingSection";
import PromotionSection      from "@/components/PromotionSection";
import TrainingSection       from "@/components/TrainingSection";
import ForeignTrainingSection from "@/components/ForeignTrainingSection";
import PublicationSection    from "@/components/PublicationSection";
import AwardSection          from "@/components/AwardSection";
import Signatures            from "@/components/Signatures";
import PageFoot              from "@/components/PageFoot";
import Sheet                 from "@/components/Sheet";

export default async function PrintProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/");

  const { id } = await params;
  const record = await getEmployeeRecord(id).catch(() => null);
  if (!record) notFound();

  return (
    <main className="flex flex-col items-center gap-5 px-5 py-10 pb-32">
      <Sheet>
        <GovHeader org={record.org} />
        <DocumentTitle />
        <PersonalSection personal={record} emergency={record.emergency_contact} />
        <CurrentJobSection job={record.current_job} />
        <AddressSection addresses={record.addresses} />
        <PageFoot page={1} total={3} />
      </Sheet>

      <Sheet>
        <GovHeader org={record.org} />
        <div className="mt-7">
          <EducationSection rows={record.education} />
          <PostingSection rows={record.work_history} />
          <PromotionSection rows={record.promotions} />
        </div>
        <PageFoot page={2} total={3} />
      </Sheet>

      <Sheet>
        <GovHeader org={record.org} />
        <div className="mt-7">
          <TrainingSection rows={record.trainings} />
          <ForeignTrainingSection rows={record.foreign_trainings} />
          <PublicationSection rows={record.publications} />
          <AwardSection rows={record.awards} />
        </div>
        <Signatures />
        <PageFoot page={3} total={3} />
      </Sheet>
    </main>
  );
}
