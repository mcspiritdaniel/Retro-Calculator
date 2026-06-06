import { roundToDisplayDecimalPlaces } from "./lcd-format";
import { roundToInternalPrecision } from "./number-precision";
import type { PaymentMode } from "./tvm-solver";

export type AmortizationResult = {
  totalInterest: number;
  totalPrincipal: number;
  remainingPv: number;
  totalAmortizedPeriods: number;
};

function periodInterest(
  balance: number,
  iPercent: number,
  decimalPlaces: number,
  pmt: number,
): number {
  const magnitude = roundToDisplayDecimalPlaces(
    (Math.abs(balance) * iPercent) / 100,
    decimalPlaces,
  );
  return magnitude * (pmt < 0 ? -1 : pmt > 0 ? 1 : 0);
}

/** AMORT — apply `periods` payments against the current loan balance. */
export function amortizePayments(
  pv: number,
  pmt: number,
  iPercent: number,
  periodsToAmortize: number,
  alreadyAmortized: number,
  paymentMode: PaymentMode,
  decimalPlaces: number,
): AmortizationResult {
  const periods = Math.max(0, Math.trunc(periodsToAmortize));
  let balance = pv;
  let totalInterest = 0;
  let totalPrincipal = 0;

  for (let index = 0; index < periods; index += 1) {
    const periodNumber = alreadyAmortized + index;
    const interest =
      periodNumber === 0 && paymentMode === "beg"
        ? 0
        : periodInterest(balance, iPercent, decimalPlaces, pmt);
    const principal = pmt - interest;

    totalInterest += interest;
    totalPrincipal += principal;
    balance += principal;
  }

  return {
    totalInterest: roundToInternalPrecision(totalInterest),
    totalPrincipal: roundToInternalPrecision(totalPrincipal),
    remainingPv: roundToInternalPrecision(balance),
    totalAmortizedPeriods: alreadyAmortized + periods,
  };
}

/** Simple interest on a 360-day basis: I = |PV| × i × n / 360. */
export function simpleInterest360(
  pv: number,
  iPercent: number,
  days: number,
): number {
  return simpleInterestForYearBasis(pv, iPercent, days, 360);
}

/** Simple interest on a 365-day basis: I = |PV| × i × n / 365. */
export function simpleInterest365(
  pv: number,
  iPercent: number,
  days: number,
): number {
  return simpleInterestForYearBasis(pv, iPercent, days, 365);
}

function simpleInterestForYearBasis(
  pv: number,
  iPercent: number,
  days: number,
  yearBasis: number,
): number {
  const magnitude = roundToInternalPrecision(
    (Math.abs(pv) * iPercent * days) / (yearBasis * 100),
  );
  return pv <= 0 ? magnitude : -magnitude;
}
