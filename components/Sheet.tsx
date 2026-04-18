import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Sheet({ children }: Props) {
  return (
    <div
      className="page-sheet relative flex w-[8.5in] flex-col overflow-hidden bg-paper px-[0.6in] py-[0.55in]"
      style={{
        minHeight: "11in",
        boxShadow:
          "0 1px 0 rgba(0,0,0,0.03), 0 20px 60px -20px rgba(30,28,22,0.25), 0 4px 12px -4px rgba(30,28,22,0.08)",
      }}
    >
      {children}
    </div>
  );
}
