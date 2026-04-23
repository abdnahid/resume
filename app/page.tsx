import { getEmployeeRecord, DEFAULT_EMPLOYEE_ID } from "@/lib/db";
import GovHeader from "@/components/GovHeader";
import DocumentTitle from "@/components/DocumentTitle";
import PersonalSection from "@/components/PersonalSection";
import CurrentJobSection from "@/components/CurrentJobSection";
import AddressSection from "@/components/AddressSection";
import EducationSection from "@/components/EducationSection";
import PostingSection from "@/components/PostingSection";
import PromotionSection from "@/components/PromotionSection";
import TrainingSection from "@/components/TrainingSection";
import ForeignTrainingSection from "@/components/ForeignTrainingSection";
import PublicationSection from "@/components/PublicationSection";
import AwardSection from "@/components/AwardSection";
import Signatures from "@/components/Signatures";
import PageFoot from "@/components/PageFoot";
import Sheet from "@/components/Sheet";

export default async function Page() {
  const record = await getEmployeeRecord(DEFAULT_EMPLOYEE_ID);

  return (
    <main className="flex min-h-screen flex-col items-center gap-5 px-5 pb-32 pt-10">
      {/* Page 1 */}
      <Sheet>
        <GovHeader org={record.org} />
        <DocumentTitle />
        <PersonalSection
          personal={record.personal}
          emergency={record.emergency_contact}
        />
        <CurrentJobSection job={record.current_job} />
        <AddressSection addresses={record.addresses} />
        <PageFoot page={1} total={3} />
      </Sheet>

      {/* Page 2 */}
      <Sheet>
        <GovHeader org={record.org} />
        <div className="mt-7">
          <EducationSection rows={record.education} />
          <PostingSection rows={record.postings} />
          <PromotionSection rows={record.promotions} />
        </div>
        <PageFoot page={2} total={3} />
      </Sheet>

      {/* Page 3 */}
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

      <div className="no-print font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
        Designed and Developed by{" "}
        <a
          href="https://github.com/abdnahid"
          target="_blank"
          rel="noopener noreferrer"
        >
          AbdNahid
        </a>
      </div>
    </main>
  );
}
