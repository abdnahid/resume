import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username, phoneNumber } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prisma } from "./prisma";

/**
 * OTP is deliberately not enabled in this phase (§2.6). The phone-number plugin
 * requires a `sendOTP` callback even when `requireVerification` is false and no
 * OTP endpoint is exposed, so this stands in its place and fails loudly rather
 * than silently dropping a code on the floor.
 *
 * When SMS arrives: implement this, flip `requireVerification`, and stamp
 * `mobileVerifiedAt` in `callbackOnVerification`. The schema already carries the
 * column, so no migration is needed.
 */
async function otpNotEnabled(): Promise<never> {
  throw new APIError("NOT_IMPLEMENTED", {
    message: "SMS OTP is not enabled yet. Sign in with your password.",
  });
}

/**
 * Employees log in with their employee ID and nothing else. Their rows carry a
 * derived `@bsti.gov.bd` address, so without this an employee could slip in
 * through the client lane's email field. Clients are unaffected — they have no
 * `username`, so the internal lane can never resolve them in the first place.
 */
const blockInternalOnClientLanes = createAuthMiddleware(async (ctx) => {
  const body = ctx.body as { email?: string; phoneNumber?: string } | undefined;

  const where =
    ctx.path === "/sign-in/email" && body?.email
      ? { email: body.email }
      : ctx.path === "/sign-in/phone-number" && body?.phoneNumber
        ? { mobile: body.phoneNumber }
        : null;

  if (!where) return;

  const user = await prisma.user.findUnique({
    where,
    select: { accountType: true },
  });

  if (user?.accountType === "INTERNAL") {
    throw new APIError("UNAUTHORIZED", {
      message: "BSTI staff sign in with their employee ID.",
    });
  }
});

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: ["http://localhost:3000", "http://localhost:3001"],
  emailAndPassword: {
    enabled: true,
  },
  session: {
    /**
     * Mirrors the session and user — `accountType` included — into a signed
     * `session_data` cookie so `middleware.ts` can refuse an internal route at
     * the edge, where Prisma is unreachable (D12). It is a fast path, not the
     * authority: `requireInternal()` re-checks against the database.
     */
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "employee",
        input: false,
      },
      accountType: {
        type: "string",
        required: true,
        defaultValue: "INTERNAL",
        // Never client-settable — otherwise a registration could claim INTERNAL.
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        /**
         * Anything created through a better-auth sign-up endpoint is a client.
         * Employee rows are written directly with Prisma in
         * `app/api/employees/route.ts` and never pass through here, so they keep
         * the schema default of INTERNAL. Forcing it here rather than patching
         * the row afterwards means a client account is never momentarily
         * INTERNAL.
         */
        before: async (user) => ({
          data: {
            ...user,
            accountType: "CLIENT" as const,
            // Not `employee` — see the Role enum note in schema.prisma.
            role: "client" as const,
          },
        }),
      },
    },
  },
  hooks: {
    before: blockInternalOnClientLanes,
  },
  plugins: [
    username(),
    phoneNumber({
      sendOTP: otpNotEnabled,
      // Password sign-in with no OTP step. `requireVerification` defaults to
      // false, which is what keeps /sign-in/phone-number a pure credential check.
      requireVerification: false,
      schema: {
        user: {
          fields: {
            phoneNumber: "mobile",
            phoneNumberVerified: "mobileVerified",
          },
        },
      },
    }),
  ],
});
