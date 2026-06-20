"use client";

import { useState } from "react";
import { Printer, Loader2 } from "lucide-react";

export default function PrintButton({ employeeId }: { employeeId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/approvals/${employeeId}/pdf`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `profile-${employeeId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors cursor-pointer"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
      {loading ? "Generating PDF…" : "Download PDF"}
    </button>
  );
}
