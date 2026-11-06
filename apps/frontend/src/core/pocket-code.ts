/**
 * The pocket code — the only credential a partner needs to join (BRD FR-02): 10
 * characters, 4 digits + 3 letters + 3 alphanumeric (e.g. `4821kPz7xQ`). Pure (rule
 * P4): entropy comes from the injected `random`, so tests are deterministic and this
 * module never touches I/O.
 */

const DIGITS = "0123456789";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ALPHANUMERIC = LETTERS + DIGITS;

/** Structure of the code, shared with the Zod schema so join rejects malformed input before any lookup. */
const PATTERN = /^\d{4}[A-Za-z]{3}[A-Za-z0-9]{3}$/;

export function isValidPocketCode(value: string): boolean {
  return PATTERN.test(value);
}

/** An integer in [0, max), uniformly — rejection sampling, because `%` is biased. */
function secureRandom(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

/**
 * `random(max)` must return a uniform integer in [0, max); the default is the platform
 * CSPRNG. Uniqueness is not pre-checked: `workspaces.inviteCode` is UNIQUE and the
 * caller retries once on a collision (design D7).
 */
export function generatePocketCode(random: (max: number) => number = secureRandom): string {
  const pick = (chars: string) => chars[random(chars.length)];
  return (
    pick(DIGITS) +
    pick(DIGITS) +
    pick(DIGITS) +
    pick(DIGITS) +
    pick(LETTERS) +
    pick(LETTERS) +
    pick(LETTERS) +
    pick(ALPHANUMERIC) +
    pick(ALPHANUMERIC) +
    pick(ALPHANUMERIC)
  );
}
