/** Largest n for which n! is computed exactly. */
export const FACTORIAL_MAX_N = 69;

/** Displayed when n! is requested for n > 69 (overflow). */
export const FACTORIAL_OVERFLOW = 9.999999999e99;

/** n! — factorial for non-negative integers only. */
export function factorial(n: number): number {
  if (!Number.isFinite(n) || n < 0) {
    return Number.NaN;
  }

  const k = Math.trunc(n);
  if (k !== n) {
    return Number.NaN;
  }

  if (k > FACTORIAL_MAX_N) {
    return FACTORIAL_OVERFLOW;
  }

  let result = 1;
  for (let i = 2; i <= k; i += 1) {
    result *= i;
  }

  return result;
}
