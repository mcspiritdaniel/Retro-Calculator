/**
 * Cash-flow NPV and IRR.
 * CF₀ is undiscounted; CFⱼ for j ≥ 1 is discounted by (1 + i/100)^j.
 * Nj repeats each stored CFⱼ amount for consecutive periods.
 */

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-10;

export function expandCashFlows(
  cashFlows: readonly number[],
  counts: readonly number[],
): number[] {
  const expanded: number[] = [];

  for (let index = 0; index < cashFlows.length; index += 1) {
    const repetitions = Math.max(0, Math.trunc(counts[index] ?? 1));
    if (repetitions === 0) {
      continue;
    }

    for (let repeat = 0; repeat < repetitions; repeat += 1) {
      expanded.push(cashFlows[index]);
    }
  }

  return expanded;
}

/** Cash-flow NPV on an expanded period series. */
export function computeNpv(cashFlows: readonly number[], iPercent: number): number {
  if (cashFlows.length === 0) {
    return 0;
  }

  const rate = iPercent / 100;
  let npv = cashFlows[0];

  for (let j = 1; j < cashFlows.length; j++) {
    npv += cashFlows[j] / Math.pow(1 + rate, j);
  }

  return npv;
}

export function computeNpvFromRegisters(
  cashFlows: readonly number[],
  counts: readonly number[],
  iPercent: number,
): number {
  return computeNpv(expandCashFlows(cashFlows, counts), iPercent);
}

function npvDerivative(cashFlows: readonly number[], iPercent: number): number {
  if (cashFlows.length <= 1) {
    return 0;
  }

  const rate = iPercent / 100;
  let derivative = 0;

  for (let j = 1; j < cashFlows.length; j++) {
    derivative -= (j * cashFlows[j]) / (100 * Math.pow(1 + rate, j + 1));
  }

  return derivative;
}

/** Solve for the rate (percent) that makes NPV equal zero. */
export function computeIrr(
  cashFlows: readonly number[],
  counts: readonly number[],
  guessPercent = 10,
): number {
  const expanded = expandCashFlows(cashFlows, counts);
  if (expanded.length < 2) {
    return Number.NaN;
  }

  const hasPositive = expanded.some((value) => value > 0);
  const hasNegative = expanded.some((value) => value < 0);
  if (!hasPositive || !hasNegative) {
    return Number.NaN;
  }

  const seeds = [
    guessPercent,
    0,
    5,
    10,
    15,
    20,
    -5,
    50,
  ].filter((value, index, array) => array.indexOf(value) === index);

  for (const seed of seeds) {
    const solved = solveIrrNewton(expanded, seed);
    if (solved !== null && Number.isFinite(solved)) {
      return solved;
    }
  }

  return solveIrrBisection(expanded);
}

function solveIrrNewton(expanded: readonly number[], guessPercent: number): number | null {
  let iPercent = guessPercent;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const value = computeNpv(expanded, iPercent);
    if (!Number.isFinite(value)) {
      return null;
    }

    if (Math.abs(value) < TOLERANCE) {
      return iPercent;
    }

    const slope = npvDerivative(expanded, iPercent);
    if (Math.abs(slope) < TOLERANCE) {
      return null;
    }

    const next = iPercent - value / slope;
    if (!Number.isFinite(next) || next <= -99.999999) {
      return null;
    }

    if (Math.abs(next - iPercent) < TOLERANCE) {
      return Math.abs(computeNpv(expanded, next)) < 1e-6 ? next : null;
    }

    iPercent = next;
  }

  return Math.abs(computeNpv(expanded, iPercent)) < 1e-6 ? iPercent : null;
}

function solveIrrBisection(expanded: readonly number[]): number {
  let low = -99;
  let high = 1000;
  let fLow = computeNpv(expanded, low);
  let fHigh = computeNpv(expanded, high);

  while (fLow * fHigh > 0 && high < 1e6) {
    high *= 2;
    fHigh = computeNpv(expanded, high);
  }

  if (fLow * fHigh > 0) {
    return Number.NaN;
  }

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const mid = (low + high) / 2;
    const fMid = computeNpv(expanded, mid);

    if (Math.abs(fMid) < TOLERANCE) {
      return mid;
    }

    if (fLow * fMid <= 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return (low + high) / 2;
}
