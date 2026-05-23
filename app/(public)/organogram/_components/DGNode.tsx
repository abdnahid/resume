import { WINGS, DIVISIONAL_OFFICES, REGIONAL_OFFICES, sumStaff } from "./data";

export default function DGNode() {
  const allEntries = [...WINGS, ...DIVISIONAL_OFFICES, ...REGIONAL_OFFICES];
  const grandTotal = allEntries.reduce((sum, e) => sum + sumStaff(e), 0);

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-72 rounded-2xl text-white shadow-xl"
        style={{ background: "var(--primary)" }}
      >
        <div className="px-8 py-4 text-center">
          <p className="text-xl font-bold leading-tight text-white">
            Director General
          </p>
          <p className="text-sm font-medium font-bn-serif opacity-80 mt-0.5 text-gray-100">
            মহাপরিচালক
          </p>
          <div className="mt-3 flex justify-center">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold font-bn-serif">
              মোট জনবল: {grandTotal}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
