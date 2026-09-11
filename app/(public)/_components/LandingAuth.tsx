"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import AccountMenu, { useMe } from "@/components/layout/AccountMenu";

/**
 * Masthead auth control for the landing page.
 *
 * A client component so the page itself stays static — awaiting a session on
 * the server would make `/` dynamic on every request for the sake of one
 * control.
 *
 * **Signed in, it is `AccountMenu` — the same control as everywhere else.** It
 * used to be a button to `/public/dashboard`, which is the identity-as-a-link
 * mistake `AccountMenu` exists to correct, repeated on the one page where the
 * account control is the whole masthead. A name is a label; the actions belong
 * behind the caret.
 *
 * Signed out it keeps its own pair of buttons: there is no account to describe,
 * and sign-in and sign-up are the two things a visitor came for.
 */
export default function LandingAuth() {
  const { data: session, isPending } = authClient.useSession();
  const isInternal =
    (session?.user as { accountType?: string } | undefined)?.accountType === "INTERNAL";
  // The designation and desks the session does not carry. Staff only — asking
  // on a client's behalf earns a 403 for nothing.
  const me = useMe(isInternal);

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/";
  }

  if (isPending) {
    return <span className="h-10 w-28 animate-pulse rounded-lg bg-secondary" />;
  }

  if (session) {
    return (
      <div className="flex shrink-0 items-center">
        <AccountMenu
          fallbackName={session.user.name}
          me={me}
          isInternal={isInternal}
          onSignOut={handleSignOut}
        />
      </div>
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
