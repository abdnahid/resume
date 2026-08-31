/**
 * Which gateway is in use.
 *
 * One place, so adding SSLCommerz or the e-Challan is a registry entry plus a
 * file — not a search for every call site.
 */
import type { PaymentProvider } from "./provider";
import { sandboxProvider } from "./sandbox";

const PROVIDERS: Record<string, PaymentProvider> = {
  [sandboxProvider.key]: sandboxProvider,
};

/**
 * The active provider. Defaults to the sandbox: the gateway decision (spec §6)
 * is open, so the safe default is the one that cannot move money.
 */
export function activeProvider(): PaymentProvider {
  const key = process.env.PAYMENT_PROVIDER?.trim() || sandboxProvider.key;
  const provider = PROVIDERS[key];
  if (!provider) {
    throw new Error(
      `PAYMENT_PROVIDER="${key}" is not a known gateway. Known: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return provider;
}

/** Look one up by name — for reading a historical payment's own provider. */
export function providerByKey(key: string): PaymentProvider | null {
  return PROVIDERS[key] ?? null;
}
