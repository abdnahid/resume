"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  User, MapPin, Landmark, GraduationCap, Briefcase, History,
  TrendingUp, BookOpen, Users, Languages, Star, FileText,
  Trophy, ShieldAlert, CheckCircle2, Circle, Send, Clock, AlertCircle,
} from "lucide-react";
import type { ProfileCompletion, StepKey } from "@/lib/profile-completion";

type Step = { key: StepKey; label: string; icon: React.ElementType; isRequired: boolean };

const STEPS: Step[] = [
  { key: "personal",     label: "Personal Info",        icon: User,          isRequired: true  },
  { key: "address",      label: "Address",              icon: MapPin,        isRequired: true  },
  { key: "bank",         label: "Bank Details",         icon: Landmark,      isRequired: false },
  { key: "education",    label: "Education",            icon: GraduationCap, isRequired: true  },
  { key: "career",       label: "BSTI Service History", icon: Briefcase,     isRequired: true  },
  { key: "experience",   label: "Previous Experience",  icon: History,       isRequired: false },
  { key: "promotions",   label: "Promotions",           icon: TrendingUp,    isRequired: false },
  { key: "training",     label: "Training",             icon: BookOpen,      isRequired: false },
  { key: "family",       label: "Family",               icon: Users,         isRequired: false },
  { key: "languages",    label: "Languages",            icon: Languages,     isRequired: false },
  { key: "curriculars",  label: "Curriculars",          icon: Star,          isRequired: false },
  { key: "publications", label: "Publications",         icon: FileText,      isRequired: false },
  { key: "awards",       label: "Awards",               icon: Trophy,        isRequired: false },
  { key: "disciplinary", label: "Disciplinary",         icon: ShieldAlert,   isRequired: false },
];

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  draft:          { label: "Draft",           cls: "bg-slate-100 text-slate-600",          Icon: Circle },
  submitted:      { label: "Under Review",    cls: "bg-amber-100 text-amber-700",           Icon: Clock },
  approved:       { label: "Approved",        cls: "bg-emerald-100 text-emerald-700",       Icon: CheckCircle2 },
  needs_revision: { label: "Needs Revision",  cls: "bg-red-100 text-red-700",              Icon: AlertCircle },
};

export default function ProfileSidebar({
  completion: initialCompletion,
  profileStatus: initialStatus,
  employeeId,
}: {
  completion: ProfileCompletion;
  profileStatus: string;
  employeeId: string;
}) {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const activeStep    = (searchParams.get("step") ?? "personal") as StepKey;
  const [submitting,   setSubmitting]   = useState(false);
  const [submitDone,   setSubmitDone]   = useState(false);
  const [submitError,  setSubmitError]  = useState("");
  const [completion,   setCompletion]   = useState(initialCompletion);
  const [profileStatus, setProfileStatus] = useState(initialStatus);

  // Refetch completion whenever the active step changes (happens after each save + navigate)
  useEffect(() => {
    fetch("/api/profile/completion")
      .then((r) => r.json())
      .then((data) => {
        if (data.completion) setCompletion(data.completion);
        if (data.profileStatus) setProfileStatus(data.profileStatus);
      })
      .catch(() => {});
  }, [activeStep]);

  const requiredDone = completion.required.pct === 100;
  const canSubmit = requiredDone && ["draft", "needs_revision", "approved"].includes(profileStatus);
  const isResubmit = profileStatus === "approved";

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true); setSubmitError("");
    const res = await fetch("/api/profile/submit", { method: "POST" }).finally(() => setSubmitting(false));
    if (!res.ok) { setSubmitError((await res.json()).error ?? "Failed"); return; }
    setProfileStatus("submitted");
    setSubmitDone(true);
  }

  const sc = STATUS_CONFIG[profileStatus] ?? STATUS_CONFIG.draft;
  const StatusIcon = sc.Icon;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card overflow-y-auto print:hidden">

      {/* Profile status */}
      <div className="px-4 pt-4 pb-2">
        <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg ${sc.cls}`}>
          <StatusIcon size={12} />
          {sc.label}
        </div>
      </div>

      {/* Progress bars */}
      <div className="px-4 py-3 border-b border-border space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Required</span>
            <span className="font-bold text-emerald-600">{completion.required.pct}%</span>
          </div>
          <ProgressBar pct={completion.required.pct} color="bg-emerald-500" />
          <p className="text-[10px] text-muted-foreground">{completion.required.filled} / {completion.required.total} fields</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Optional</span>
            <span className="font-bold text-blue-500">{completion.optional.pct}%</span>
          </div>
          <ProgressBar pct={completion.optional.pct} color="bg-blue-400" />
          <p className="text-[10px] text-muted-foreground">{completion.optional.filled} / {completion.optional.total} fields</p>
        </div>
      </div>

      {/* Step list */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {STEPS.map((step) => {
          const active = activeStep === step.key;
          const stepCompletion = completion.steps[step.key];
          const Icon = step.icon;

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => router.push(`/profile?step=${step.key}`)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left ${
                active ? "bg-secondary text-primary font-medium" : "text-body hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2.25 : 1.75} />
              <span className="flex-1 truncate">{step.label}</span>
              <span className="flex items-center gap-1 shrink-0">
                {step.isRequired && <span className="text-[9px] font-bold text-red-400">*</span>}
                {stepCompletion.done ? (
                  <CheckCircle2 size={13} className="text-emerald-500" strokeWidth={2} />
                ) : stepCompletion.filled > 0 ? (
                  <span className="text-[10px] font-semibold text-blue-400">{stepCompletion.pct}%</span>
                ) : (
                  <Circle size={13} className="text-muted-foreground/40" strokeWidth={1.5} />
                )}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Submit for Review */}
      <div className="px-4 py-4 border-t border-border">
        {submitDone || profileStatus === "submitted" ? (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <Clock size={13} /> Profile submitted for review
          </div>
        ) : (
          <>
            {isResubmit && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
                <CheckCircle2 size={12} /> Previously approved
              </div>
            )}
            {!requiredDone && (
              <p className="text-[11px] text-muted-foreground mb-2">Complete all required fields to submit for approval.</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Send size={14} />
              {submitting ? "Submitting…" : isResubmit ? "Submit Updates for Review" : "Submit for Review"}
            </button>
            {submitError && <p className="text-[11px] text-red-500 mt-1">{submitError}</p>}
          </>
        )}
      </div>
    </aside>
  );
}
