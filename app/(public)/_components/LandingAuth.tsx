"use client";

import Link from "next/link";
import { LogIn, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { INTERNAL_HOME } from "@/lib/auth-identity";

/**
 * Masthead auth control. A client component so the landing page itself stays
 * static — awaiting a session on the server would make it dynamic on every
 * request for the sake of one button.
 */
export default function LandingAuth() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <span className="h-10 w-28 animate-pulse rounded-lg bg-secondary" />;
  }

  if (session) {
    const isInternal =
      (session.user as { accountType?: string }).accountType === "INTERNAL";

    return (
      <Link
        href={isInternal ? INTERNAL_HOME : "/public/dashboard"}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        <UserRound className="h-4 w-4" strokeWidth={1.8} />
        <span className="hidden max-w-[14ch] truncate sm:inline">
          {isInternal ? "My workspace" : session.user.name}
        </span>
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-muted"
      >
        <LogIn className="h-4 w-4" strokeWidth={1.8} />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
      <Link
        href="/register"
        className="hidden items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover sm:inline-flex"
      >
        Sign up
      </Link>
    </div>
  );
}
