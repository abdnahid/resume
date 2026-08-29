"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * A button that navigates and shows that it is doing so.
 *
 * The profile wizard moves between steps with `?step=`, which stays inside the
 * same route segment — so Next never renders a `loading.tsx` for it and a plain
 * `router.push` leaves the button looking untouched for the whole wait.
 *
 * `useTransition` is what makes the pending state real: it covers the router
 * navigation itself, not just the click, so the spinner lasts exactly as long
 * as the move does.
 */
export default function StepNavButton({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.push(href))}
      className={`${className ?? ""} inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait`}
    >
      {pending && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
