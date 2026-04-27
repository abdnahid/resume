import type { AddressBlock, EmployeeRecord } from "@/lib/types";
import SectionHead from "./SectionHead";

type Props = {
  addresses: EmployeeRecord["addresses"];
};

export default function AddressSection({ addresses }: Props) {
  return (
    <section className="mt-[26px]">
      <SectionHead number="03" title="Address Information" tag="Residence" />

      <div className="grid grid-cols-2 gap-[18px]">
        <AddressCard tag="Present Address" data={addresses.present} />
        <AddressCard tag="Permanent Address" data={addresses.permanent} />
      </div>
    </section>
  );
}

function AddressCard({ tag, data }: { tag: string; data: AddressBlock }) {
  return (
    <div className="relative border border-rule bg-white px-4 py-3.5">
      <span className="absolute top-[-9px] left-3.5 bg-paper px-2 font-mono text-[7pt] uppercase tracking-[0.22em] text-primary">
        {tag}
      </span>
      <div className="mb-2 font-bn text-[10.5pt] leading-normal text-ink">
        {data.line_en}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <Pair k="Thana" v={data.thana} bn={data.thana_bn} />
        <Pair k="Upazila" v={data.upazila} bn={data.upazila_bn} />
        <Pair k="Post Office" v={data.post_office} />
        <Pair k="Post Code" v={data.post_code} />
        <Pair k="District" v={data.district} bn={data.district_bn} />
      </div>
    </div>
  );
}

function Pair({ k, v, bn }: { k: string; v: string; bn?: boolean }) {
  return (
    <>
      <div className="font-mono text-[7pt] uppercase tracking-tracked-sm text-ink-3">
        {k}
      </div>
      <div
        className={
          bn
            ? "font-bn text-[9.5pt] text-ink"
            : "font-body text-[9.5pt] text-ink"
        }
      >
        {v}
      </div>
    </>
  );
}
