export default function Signatures() {
  return (
    <div className="mt-10 grid grid-cols-2 gap-16 pt-8">
      <SigBlock label="Signature of Employee" />
      <SigBlock label="Signature & Seal of Authorized Officer" />
    </div>
  );
}

function SigBlock({ label }: { label: string }) {
  return (
    <div className="border-t border-ink pt-1.5 font-mono text-[8pt] uppercase tracking-tracked-sm text-ink-2">
      {label}
      <div className="mt-1 font-body text-[8.5pt] normal-case tracking-normal text-ink-3">
        Date: _______________
      </div>
    </div>
  );
}
