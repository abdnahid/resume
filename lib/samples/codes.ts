/**
 * The three identifiers a specimen carries, and how they are generated.
 * Prisma-free (D9) so a client component can format one.
 *
 * **Why three.** A QR code is an encoded string: any phone decodes it without a
 * session, so whatever is printed on the jar is readable by everyone who
 * handles it — the FDO who binds the label and the examiner who opens the box
 * alike. Printing either side's working identifier therefore hands it to the
 * other. So the printed token belongs to neither:
 *
 * | token     | printed | who works with it |
 * |-----------|---------|-------------------|
 * | `ref`     | yes     | nobody — it only resolves at `/s/<ref>` |
 * | `cmCode`  | no      | the FDO and CM staff on that application |
 * | `labCode` | no      | the examiner and testing-wing staff |
 *
 * Neither working code is ever printed, so correlating them needs system
 * access — which is the property a salted or derived code was reaching for and
 * could not deliver. `labCode` is **not** derived from `cmCode`: a hash would
 * need the mapping stored anyway, and a rotating salt would either change the
 * code mid-test or force every old salt to be kept for ever. A sample lives for
 * weeks; its identifiers must not move.
 *
 * The key worth rotating protects the *link*, not the code — see
 * `SampleRegistration`.
 */

/**
 * Crockford base32: no I, L, O or U, so a code read off a jar cannot be
 * transcribed into a different one, and no vowels means no accidental words.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Cryptographic randomness. Sequential or time-based codes leak volume. */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/**
 * A check character over the payload, so a mistyped code is rejected rather
 * than resolving to somebody else's specimen. Weighted mod 32 — it catches
 * every single-character error and every transposition of adjacent ones.
 */
export function checkChar(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const v = ALPHABET.indexOf(payload[i]);
    if (v < 0) continue;
    sum += v * (i + 2);
  }
  return ALPHABET[sum % 32];
}

function group(s: string, size = 4): string {
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += size) parts.push(s.slice(i, i + size));
  return parts.join("-");
}

/** Strip formatting and normalise, so a typed code matches a generated one. */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[ILO]/g, (c) => ({ I: "1", L: "1", O: "0" })[c]!)
    .replace(/U/g, "V");
}

/** True when the check character agrees with the payload. */
export function isWellFormed(raw: string): boolean {
  const s = normalizeCode(raw);
  if (s.length < 5) return false;
  return checkChar(s.slice(0, -1)) === s.slice(-1);
}

function make(prefix: string, bytes: number): string {
  const payload = encode(randomBytes(bytes));
  return `${prefix}${group(payload + checkChar(payload))}`;
}

/**
 * The printed token. 128 bits, because it travels through several pairs of
 * hands on a jar and must be treated as public — guessing one has to be
 * hopeless, and the access check does the rest.
 */
export const newRef = () => make("", 16);

/** The CM side's working identifier. */
export const newCmCode = () => make("CM-", 8);

/** The testing side's working identifier. */
export const newLabCode = () => make("TS-", 8);

/** A box. Carries the destination openly — a consignment has to be couriered. */
export const newConsignmentCode = () => make("BX-", 6);

/** A lab's work item, quoted on bench sheets and reports. */
export const newTestOrderCode = () => make("TO-", 6);
