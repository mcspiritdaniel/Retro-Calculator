export type FinancialRegisters = {
  n: number;
  i: number;
  pv: number;
  pmt: number;
  fv: number;
};

export type TvmRegister = keyof FinancialRegisters;

export type PaymentMode = "end" | "beg";

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-10;

export type TvmSolveOptions = {
  mode?: PaymentMode;
  /** C indicator — compound (vs. simple) interest on the odd-period fraction of n. */
  compoundOddPeriod?: boolean;
};

function toRate(iPercent: number): number {
  return iPercent / 100;
}

function isFractionalPeriod(n: number): boolean {
  if (!Number.isFinite(n)) {
    return false;
  }

  return Math.abs(n - Math.trunc(n)) > TOLERANCE;
}

function periodParts(n: number): { full: number; fraction: number } {
  const full = Math.trunc(n);
  return { full, fraction: n - full };
}

/** HP odd-period PV factor: (1+i)^f with C on, 1+f·i with C off. */
function oddPeriodPvFactor(
  rate: number,
  fraction: number,
  compound: boolean,
): number {
  if (compound) {
    return Math.pow(1 + rate, fraction);
  }

  return 1 + fraction * rate;
}

function effectiveOddPeriodState(
  state: FinancialRegisters,
  rate: number,
  compoundOddPeriod: boolean,
): { pv: number; n: number; fv: number } {
  const { full, fraction } = periodParts(state.n);
  const pvFactor = oddPeriodPvFactor(rate, fraction, compoundOddPeriod);

  return {
    pv: state.pv * pvFactor,
    n: full,
    fv: state.fv,
  };
}

function resolveOddPeriodActive(
  state: FinancialRegisters,
  oddPeriodActive: boolean | undefined,
): boolean {
  return oddPeriodActive ?? isFractionalPeriod(state.n);
}

function discountFactor(rate: number, periods: number): number {
  return Math.pow(1 + rate, -periods);
}

function annuityFactor(rate: number, periods: number): number {
  if (periods === 0) {
    return 0;
  }
  if (Math.abs(rate) < TOLERANCE) {
    return periods;
  }
  return (1 - discountFactor(rate, periods)) / rate;
}

function annuityDerivative(rate: number, periods: number): number {
  if (Math.abs(rate) < TOLERANCE) {
    return (-periods * (periods + 1)) / 2;
  }

  const compound = Math.pow(1 + rate, -periods);
  const numerator = periods * Math.pow(1 + rate, -periods - 1) * rate - (1 - compound);
  return numerator / (rate * rate);
}

function paymentFactor(
  rate: number,
  periods: number,
  mode: PaymentMode,
): number {
  const ordinary = annuityFactor(rate, periods);
  if (mode === "beg" && Math.abs(rate) >= TOLERANCE) {
    return ordinary * (1 + rate);
  }
  return ordinary;
}

function paymentFactorDerivative(
  rate: number,
  periods: number,
  mode: PaymentMode,
): number {
  const derivative = annuityDerivative(rate, periods);
  if (mode === "beg" && Math.abs(rate) >= TOLERANCE) {
    const ordinary = annuityFactor(rate, periods);
    return derivative * (1 + rate) + ordinary;
  }
  return derivative;
}

/** TVM equation: PV + PMT·aₙ·(1+i)ⁿ + FV·(1+i)⁻ⁿ = 0 (BEG uses the (1+i) factor on PMT). */
export function tvmEquation(
  state: FinancialRegisters,
  rate: number,
  mode: PaymentMode = "end",
  compoundOddPeriod = false,
  oddPeriodActive?: boolean,
): number {
  const { n, pmt, fv } = state;

  if (resolveOddPeriodActive(state, oddPeriodActive)) {
    const effective = effectiveOddPeriodState(state, rate, compoundOddPeriod);
    return (
      effective.pv +
      pmt * paymentFactor(rate, effective.n, mode) +
      fv * discountFactor(rate, effective.n)
    );
  }

  return state.pv + pmt * paymentFactor(rate, n, mode) + fv * discountFactor(rate, n);
}

export function solvePmt(
  state: FinancialRegisters,
  mode: PaymentMode = "end",
  compoundOddPeriod = false,
): number {
  const { n, i, fv } = state;
  if (n === 0) {
    return Number.NaN;
  }

  const rate = toRate(i);

  if (isFractionalPeriod(n)) {
    const effective = effectiveOddPeriodState(state, rate, compoundOddPeriod);
    const factor = paymentFactor(rate, effective.n, mode);
    if (Math.abs(factor) < TOLERANCE) {
      return Number.NaN;
    }

    return (
      -(effective.pv + fv * discountFactor(rate, effective.n)) / factor
    );
  }

  const factor = paymentFactor(rate, n, mode);
  if (Math.abs(factor) < TOLERANCE) {
    return Number.NaN;
  }

  return -(state.pv + fv * discountFactor(rate, n)) / factor;
}

export function solvePv(
  state: FinancialRegisters,
  mode: PaymentMode = "end",
  compoundOddPeriod = false,
): number {
  const { n, i, pmt, fv } = state;
  const rate = toRate(i);

  if (isFractionalPeriod(n)) {
    const { full, fraction } = periodParts(n);
    const loanSide =
      -pmt * paymentFactor(rate, full, mode) - fv * discountFactor(rate, full);
    const pvFactor = oddPeriodPvFactor(rate, fraction, compoundOddPeriod);
    if (Math.abs(pvFactor) < TOLERANCE) {
      return Number.NaN;
    }

    return loanSide / pvFactor;
  }

  return -pmt * paymentFactor(rate, n, mode) - fv * discountFactor(rate, n);
}

export function solveFv(
  state: FinancialRegisters,
  mode: PaymentMode = "end",
  compoundOddPeriod = false,
): number {
  const { n, i, pv, pmt } = state;
  const rate = toRate(i);

  if (isFractionalPeriod(n)) {
    const effective = effectiveOddPeriodState(state, rate, compoundOddPeriod);
    const accumulated =
      effective.pv + pmt * paymentFactor(rate, effective.n, mode);
    if (Math.abs(rate) < TOLERANCE) {
      return -accumulated;
    }

    return -accumulated * Math.pow(1 + rate, effective.n);
  }

  const accumulated = pv + pmt * paymentFactor(rate, n, mode);
  if (Math.abs(rate) < TOLERANCE) {
    return -accumulated;
  }
  return -accumulated * Math.pow(1 + rate, n);
}

function solveNEnd(state: FinancialRegisters): number {
  const { i, pv, pmt, fv } = state;
  const rate = toRate(i);

  if (Math.abs(pmt) < TOLERANCE) {
    return Number.NaN;
  }

  if (Math.abs(rate) < TOLERANCE) {
    return -(pv + fv) / pmt;
  }

  const numerator = pv * rate + pmt;
  const denominator = pmt - fv * rate;
  if (Math.abs(denominator) < TOLERANCE || numerator / denominator <= 0) {
    return Number.NaN;
  }

  const discounted = numerator / denominator;
  return -Math.log(discounted) / Math.log(1 + rate);
}

function solveNBeg(state: FinancialRegisters): number {
  const { i, pv, pmt, fv } = state;
  const rate = toRate(i);

  if (Math.abs(pmt) < TOLERANCE) {
    return Number.NaN;
  }

  if (Math.abs(rate) < TOLERANCE) {
    return -(pv + fv) / pmt;
  }

  const evaluate = (periods: number) =>
    tvmEquation({ ...state, n: periods }, rate, "beg", false, false);

  let low = TOLERANCE;
  let high = 1;
  let fLow = evaluate(low);
  let fHigh = evaluate(high);

  while (fLow * fHigh > 0 && high < 1e8) {
    high *= 2;
    fHigh = evaluate(high);
  }

  if (fLow * fHigh > 0) {
    return Number.NaN;
  }

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const mid = (low + high) / 2;
    const fMid = evaluate(mid);

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

/**
 * Classic hardware rounds n up to the next integer when the exact period count is fractional,
 * so the displayed value is the total number of payments (full + one partial).
 */
function roundFractionalPeriodCountUp(exact: number): number {
  if (!Number.isFinite(exact)) {
    return exact;
  }

  const nearestInteger = Math.round(exact);
  if (Math.abs(exact - nearestInteger) < TOLERANCE) {
    return nearestInteger;
  }

  return Math.ceil(exact - TOLERANCE);
}

export function solveN(
  state: FinancialRegisters,
  mode: PaymentMode = "end",
): number {
  const exact = mode === "beg" ? solveNBeg(state) : solveNEnd(state);
  return roundFractionalPeriodCountUp(exact);
}

export function solveInterest(
  state: FinancialRegisters,
  mode: PaymentMode = "end",
  compoundOddPeriod = false,
): number {
  const { n, pv, pmt, fv } = state;
  if (n === 0) {
    return Number.NaN;
  }

  const oddPeriod = isFractionalPeriod(n);
  const evaluate = (rate: number) =>
    tvmEquation(state, rate, mode, compoundOddPeriod, oddPeriod);

  const tryNewton = (guess: number): number | null => {
    let rate = guess;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
      const value = evaluate(rate);
      if (!Number.isFinite(value) || Math.abs(value) < TOLERANCE) {
        return rate * 100;
      }

      const effectiveN = oddPeriod ? periodParts(n).full : n;
      const slope =
        pmt * paymentFactorDerivative(rate, effectiveN, mode) -
        fv * effectiveN * Math.pow(1 + rate, -effectiveN - 1);
      if (Math.abs(slope) < TOLERANCE) {
        return null;
      }

      const next = rate - value / slope;
      if (!Number.isFinite(next) || next <= -0.999999) {
        return null;
      }

      if (Math.abs(next - rate) < TOLERANCE) {
        return next * 100;
      }

      rate = next;
    }

    return Math.abs(evaluate(rate)) < 1e-6 ? rate * 100 : null;
  };

  const seeds = [0.01, 0.05, 0.1, 0.2, 0.001, 0.5];
  for (const seed of seeds) {
    const solved = tryNewton(seed);
    if (solved !== null && Number.isFinite(solved)) {
      return solved;
    }
  }

  let low = -0.99;
  let high = 5;
  let fLow = evaluate(low);
  let fHigh = evaluate(high);

  if (fLow * fHigh > 0) {
    return Number.NaN;
  }

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const mid = (low + high) / 2;
    const fMid = evaluate(mid);

    if (Math.abs(fMid) < TOLERANCE) {
      return mid * 100;
    }

    if (fLow * fMid <= 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return ((low + high) / 2) * 100;
}

export function solveTvm(
  target: TvmRegister,
  state: FinancialRegisters,
  mode: PaymentMode = "end",
  compoundOddPeriod = false,
): number {
  switch (target) {
    case "n":
      return solveN(state, mode);
    case "i":
      return solveInterest(state, mode, compoundOddPeriod);
    case "pv":
      return solvePv(state, mode, compoundOddPeriod);
    case "pmt":
      return solvePmt(state, mode, compoundOddPeriod);
    case "fv":
      return solveFv(state, mode, compoundOddPeriod);
    default:
      return Number.NaN;
  }
}
