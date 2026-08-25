import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { CLIENT_HOME, displayEmail } from "./auth-identity";

/**
 * Route guards. The authoritative half of D12 — `middleware.ts` refuses obvious
 * cases at the edge from a signed cookie, and these re-check against the
 * database so a stale cookie can never grant access.
 *
 * Server-only: imports Prisma. Never import this from a client component.
 */

export type AccountType = "INTERNAL" | "CLIENT";

export type Viewer = {
  id: string;
  name: string;
  accountType: AccountType;
  /** Internal role. Meaningless for clients — they are all plain buyers today. */
  role: string;
  /** Employee ID. Null for clients. */
  employeeId: string | null;
  mobile: string | null;
  /** Null when the address on file is a mobile-only placeholder. */
  email: string | null;
};

/**
 * The signed-in user, or null. Reads the user row directly rather than trusting
 * the session's cached copy, so revoking access takes effect immediately.
 */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      accountType: true,
      role: true,
      username: true,
      mobile: true,
      email: true,
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    accountType: user.accountType,
    role: user.role,
    employeeId: user.accountType === "INTERNAL" ? user.username : null,
    mobile: user.mobile,
    email: displayEmail(user.email),
  };
}

/**
 * Gate an internal module. Anonymous visitors go to the login page with a return
 * URL — they may well be staff. A signed-in *client* is redirected to the public
 * landing page silently: a citizen never sees an error screen, and nothing is
 * revealed about what exists on the internal side.
 */
export async function requireInternal(returnTo?: string): Promise<Viewer> {
  const viewer = await getViewer();

  if (!viewer) {
    const target = returnTo
      ? `/login?redirect=${encodeURIComponent(returnTo)}`
      : "/login";
    redirect(target);
  }

  if (viewer.accountType !== "INTERNAL") redirect(CLIENT_HOME);

  return viewer;
}

/**
 * Require a signed-in user on a client surface — checkout, the client dashboard.
 * Deliberately does *not* demand `CLIENT`: an employee browsing the store is a
 * buyer who happens to have an employee ID (D13), and is rendered there as a
 * customer. Callers wanting the customer view should read `accountType` to pick
 * the chrome, not to refuse entry.
 */
export async function requireClient(returnTo?: string): Promise<Viewer> {
  const viewer = await getViewer();

  if (!viewer) {
    const target = returnTo
      ? `/login?redirect=${encodeURIComponent(returnTo)}`
      : "/login";
    redirect(target);
  }

  return viewer;
}
