type Props = {
  page: number;
  total: number;
};

export default function PageFoot({ page, total }: Props) {
  return (
    <div className="mt-5 flex items-center justify-between border-t border-rule pt-6 font-mono text-[7pt] uppercase tracking-[0.18em] text-ink-4">
      <span>Personal Data Sheet · BSTI</span>
      <span>
        Page {page} / {total}
      </span>
    </div>
  );
}
