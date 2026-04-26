import type { Employee } from "@/lib/types";
import SectionHead from "./SectionHead";
import Image from "next/image";

type Props = {
  personal: Employee;
  emergency: Employee["emergency_contact"];
};

export default function PersonalSection({ personal, emergency }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead
        number="01"
        title="Personal Information"
        tag="Non-Confidential"
      />

      <div className="grid grid-cols-[140px_1fr] items-start gap-6">
        {/* Photo slot */}
        <div>
          <PhotoSlot label={personal.photo_label} />
        </div>

        {/* Right — name + details + parents + contact + emergency */}
        <div>
          <NameLockup
            nameBn={personal.name.bn}
            nameEn={personal.name.en}
            role={personal.role_en}
            employee_id={personal.id}
          />

          <div className="grid grid-cols-3 gap-x-[22px] gap-y-2.5">
            <KV k="Date of Birth" v={personal.date_of_birth} mono />
            <KV k="Blood Group" v={personal.blood_group} mono />
            <KV k="Gender" v={personal.gender} />
            <KV k="Marital Status" v={personal.marital_status} />
            <KV k="NID" v={personal.nid} mono />
            <KV k="Passport" v={personal.passport_no} mono />
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-[18px]">
            <ParentCard
              tag="Father"
              nameBn={personal.father_name.bn}
              nameEn={personal.father_name.en}
            />
            <ParentCard
              tag="Mother"
              nameBn={personal.mother_name.bn}
              nameEn={personal.mother_name.en}
            />
          </div>

          <ContactStrip
            mobileHome={personal.mobile_home}
            mobileOffice={personal.mobile_office}
            phone={personal.phone}
            email={personal.email}
          />

          <EmergencyBand emergency={emergency} />
        </div>
      </div>
    </section>
  );
}

function PhotoSlot({ label }: { label?: string }) {
  return (
    <div className="photo-stripes relative grid h-[170px] w-[140px] place-items-center border border-rule-strong text-center font-mono text-[7.5pt] uppercase leading-snug tracking-[0.18em] text-ink-3">
      <Image
        src="/pp.jpg"
        alt="Government emblem placeholder"
        fill
        className="object-cover p-[2px]"
      />
      <span className="absolute -left-px -top-px h-2.5 w-2.5 border border-b-0 border-r-0 border-accent" />
      <span className="absolute -bottom-px -right-px h-2.5 w-2.5 border border-l-0 border-t-0 border-accent" />
    </div>
  );
}

function NameLockup({
  nameBn,
  nameEn,
  role,
  employee_id,
}: {
  nameBn: string;
  nameEn: string;
  role: string;
  employee_id: string;
}) {
  return (
    <div className="mb-3 border-b border-rule pb-2.5">
      <p className="m-0 font-bn-serif text-[20pt] font-semibold leading-[1.1] text-ink">
        {nameBn}
      </p>
      <p className="mt-1 font-display text-[18pt] font-normal leading-[1.1] tracking-[-0.01em]">
        {nameEn}
      </p>
      <p className="mt-1.5 font-display text-[11pt] italic text-accent">
        {role}
      </p>
      <p className="mt-1.5 font-display font-semibold">
        <span className="text-sm border rounded-lg p-2 border-accent">
          Employee ID: {employee_id}
        </span>
      </p>
    </div>
  );
}

function KV({
  k,
  v,
  mono,
  bn,
}: {
  k: string;
  v: string;
  mono?: boolean;
  bn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-px border-l border-rule pl-2.5">
      <div className="font-mono text-[7pt] uppercase tracking-[0.18em] text-ink-3">
        {k}
      </div>
      <div
        className={[
          "text-[10pt] leading-snug text-ink",
          mono ? "font-mono tracking-[0.02em] text-[9pt]" : "font-body",
          bn ? "font-bn" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {v}
      </div>
    </div>
  );
}

function ParentCard({
  tag,
  nameBn,
  nameEn,
}: {
  tag: string;
  nameBn: string;
  nameEn: string;
}) {
  return (
    <div className="border-t border-rule pt-2">
      <div className="mb-1 font-mono text-[7pt] uppercase tracking-tracked text-accent">
        {tag}
      </div>
      <div className="font-bn-serif text-[11pt] font-medium leading-snug">
        {nameBn}
      </div>
      <div className="mt-0.5 font-display text-[10pt] italic text-ink-3">
        {nameEn}
      </div>
    </div>
  );
}

function ContactStrip({
  mobileHome,
  mobileOffice,
  phone,
  email,
}: {
  mobileHome: string;
  mobileOffice: string;
  phone: string;
  email: string;
}) {
  const cells: [string, string][] = [
    ["Mobile · Home", mobileHome],
    ["Mobile · Office", mobileOffice],
    ["Phone", phone],
    ["Email", email],
  ];
  return (
    <div className="mt-3.5 grid grid-cols-2 gap-px border border-rule bg-rule">
      {cells.map(([k, v]) => (
        <div key={k} className="bg-paper px-2.5 pb-1.5 pt-2.5">
          <div className="mb-0.5 font-mono text-[6.5pt] uppercase tracking-tracked text-ink-3">
            {k}
          </div>
          <div className="font-mono text-[9pt] tracking-[0.01em] text-ink">
            {v}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmergencyBand({
  emergency,
}: {
  emergency: Employee["emergency_contact"];
}) {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr_1fr] grid-rows-2 items-center gap-[18px] rounded-[2px] border border-accent-line bg-linear-to-b from-accent-soft to-transparent px-3.5 py-2.5">
      <div className="flex items-center row-span-2 gap-2 border-r border-accent-line pr-3.5 font-mono text-[7pt] uppercase tracking-[0.22em] text-accent">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        Emergency Contact
      </div>
      <BandCell k="Name" v={emergency.name} />
      <BandCell k="Relation" v={emergency.relation} />
      <BandCell k="Phone" v={emergency.phone} mono />
      <BandCell k="Mobile" v={emergency.mobile} mono />
    </div>
  );
}

function BandCell({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[6.5pt] uppercase tracking-[0.18em] text-ink-3">
        {k}
      </div>
      <div
        className={
          mono
            ? "font-mono text-[9pt] text-ink"
            : "font-body text-[10pt] text-ink"
        }
      >
        {v}
      </div>
    </div>
  );
}
