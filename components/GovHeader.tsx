import type { EmployeeRecord } from "@/lib/types";
import { GlobeIcon, MailIcon, PhoneIcon } from "lucide-react";
import Image from "next/image";

type Props = {
  org: EmployeeRecord["org"];
};

export default function GovHeader({ org }: Props) {
  return (
    <header className="grid grid-cols-[64px_1fr_64px] items-center gap-5 border-b-2 border-ink pb-3.5 mb-1 text-center">
      {/* Left: Government emblem placeholder */}
      <div className="relative h-24 w-24 overflow-hidden rounded-full bg-paper p-[2px]">
        <Image
          src="/govt.jpg"
          alt="Government emblem placeholder"
          fill
          sizes="128px"
        />
      </div>

      {/* Center: three title lines + address + links (unchanged order) */}
      <div className="flex flex-col gap-[2px] font-bn-serif leading-tight text-ink">
        <div className="text-[11pt] font-bold tracking-[0.01em]">
          {org.header_lines_bn[0]}
        </div>
        <div className="text-[11pt] font-medium">{org.header_lines_bn[1]}</div>
        <div className="text-[14pt] font-semibold tracking-[0.01em]">
          {org.header_lines_bn[2]}
        </div>
        <div className="mt-1 font-body text-xs font-normal tracking-[0.02em] text-ink-3">
          <span className="font-bn">{org.address_bn}</span>
        </div>
        <div className="mt-1 inline-flex justify-center gap-3.5 font-mono text-xs tracking-[0.08em] text-ink-2">
          <LinkItem label={org.website} kind="web" />
          <LinkItem label={org.email} kind="email" />
          <LinkItem label={org.hotline} kind="hotline" />
        </div>
      </div>

      {/* Right: BSTI emblem placeholder */}
      <div className="relative grid h-24 w-24 place-items-center rounded-full bg-paper p-1 text-center">
        <Image
          src="/bsti.svg"
          alt="Government emblem placeholder"
          fill
          sizes="128px"
        />
      </div>
    </header>
  );
}

function LinkItem({
  label,
  kind,
}: {
  label: string;
  kind: "web" | "email" | "hotline";
}) {
  const iconByKind = {
    web: <GlobeIcon size={12} color="currentColor" />,
    email: <MailIcon size={12} color="currentColor" />,
    hotline: <PhoneIcon size={12} color="currentColor" />,
  } as const;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-primary">{iconByKind[kind]}</span>
      {label}
    </span>
  );
}
