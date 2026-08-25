import { createAuthClient } from "better-auth/react";
import {
  usernameClient,
  phoneNumberClient,
} from "better-auth/client/plugins";

/**
 * Two lanes, two sign-in calls:
 *   staff   → `authClient.signIn.username({ username: employeeId, password })`
 *   clients → `authClient.signIn.phoneNumber({ phoneNumber, password })`
 *             or `authClient.signIn.email({ email, password })`
 *
 * Employee IDs and Bangladeshi mobile numbers are both 11-digit numeric, which
 * is why they live in separate columns and separate lanes — see
 * `lib/auth-identity.ts`.
 */
export const authClient = createAuthClient({
  plugins: [usernameClient(), phoneNumberClient()],
});
