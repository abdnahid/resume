type Props = {
  number: string;
  title: string;
  tag?: string;
};

export default function SectionHead({ number, title, tag }: Props) {
  return (
    <div className="mb-3.5 grid grid-cols-[auto_1fr_auto] items-center gap-3.5">
      <span className="font-display text-[22pt] italic font-normal leading-none text-accent">
        {number}
      </span>
      <span className="font-body text-[9pt] font-semibold uppercase tracking-[0.28em] text-ink">
        {title}
      </span>
      {tag ? (
        <span className="font-mono text-[7pt] uppercase tracking-[0.2em] text-ink-4">
          {tag}
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}
