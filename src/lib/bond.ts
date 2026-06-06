import {
  parseEncodedDate,
  type DateFormat,
  type ParsedDate,
} from "./calendar";
import { roundToInternalPrecision } from "./number-precision";

export type BondInputs = {
  settlementEncoded: number;
  maturityEncoded: number;
  dateFormat: DateFormat;
  /** Annual yield to maturity in percent (PRICE). */
  yieldPercent?: number;
  /** Annual coupon rate in percent. */
  couponPercent: number;
  /** Clean price as percent of par (YTM). */
  cleanPrice?: number;
};

export type BondResult = {
  cleanPrice: number;
  accruedInterest: number;
  /** Annual yield to maturity in percent. */
  yieldPercent: number;
};

const PAR_VALUE = 100;

function utcMs({ year, month, day }: ParsedDate): number {
  return Date.UTC(year, month - 1, day);
}

function compareDates(a: ParsedDate, b: ParsedDate): number {
  return utcMs(a) - utcMs(b);
}

function actualDaysBetween(start: ParsedDate, end: ParsedDate): number {
  return Math.round((utcMs(end) - utcMs(start)) / 86_400_000);
}

function addMonths(date: ParsedDate, months: number): ParsedDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1 + months, date.day));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Semiannual coupon dates aligned to maturity day/month. */
function couponDatesAroundSettlement(
  maturity: ParsedDate,
  settlement: ParsedDate,
): { previous: ParsedDate; next: ParsedDate } | null {
  if (compareDates(settlement, maturity) >= 0) {
    return null;
  }

  let cursor = maturity;
  const history: ParsedDate[] = [cursor];

  while (history.length < 500) {
    const previous = addMonths(cursor, -6);
    history.push(previous);
    if (compareDates(previous, settlement) <= 0) {
      const next = addMonths(previous, 6);
      return { previous, next };
    }
    cursor = previous;
  }

  return null;
}

function countRemainingCoupons(nextCoupon: ParsedDate, maturity: ParsedDate): number {
  let count = 0;
  let cursor = nextCoupon;

  while (compareDates(cursor, maturity) <= 0) {
    count += 1;
    cursor = addMonths(cursor, 6);
  }

  return count;
}

function dirtyPriceFromSemiannualYield(
  semiAnnualYield: number,
  semiAnnualCoupon: number,
  periodsRemaining: number,
  fractionToNextCoupon: number,
): number {
  if (periodsRemaining <= 0) {
    return Number.NaN;
  }

  const discount = 1 / (1 + semiAnnualYield);

  if (semiAnnualYield === 0) {
    return (
      semiAnnualCoupon * (periodsRemaining - 1 + fractionToNextCoupon) + PAR_VALUE
    );
  }

  if (periodsRemaining === 1) {
    return (PAR_VALUE + semiAnnualCoupon) * discount ** fractionToNextCoupon;
  }

  const couponPv =
    (semiAnnualCoupon *
      discount ** fractionToNextCoupon *
      (1 - discount ** (periodsRemaining - 1))) /
    (1 - discount);

  const redemptionPv =
    (PAR_VALUE + semiAnnualCoupon) *
    discount ** (fractionToNextCoupon + periodsRemaining - 1);

  return couponPv + redemptionPv;
}

function cleanPriceFromYield(
  yieldPercent: number,
  couponPercent: number,
  settlement: ParsedDate,
  maturity: ParsedDate,
): { cleanPrice: number; accruedInterest: number } | null {
  const schedule = couponDatesAroundSettlement(maturity, settlement);
  if (!schedule) {
    return null;
  }

  const { previous, next } = schedule;
  const daysInPeriod = actualDaysBetween(previous, next);
  if (daysInPeriod <= 0) {
    return null;
  }

  const daysAccrued = actualDaysBetween(previous, settlement);
  const daysToNextCoupon = actualDaysBetween(settlement, next);
  const semiAnnualCoupon = couponPercent / 2;
  const semiAnnualYield = yieldPercent / 200;
  const accruedInterest = semiAnnualCoupon * (daysAccrued / daysInPeriod);
  const periodsRemaining = countRemainingCoupons(next, maturity);
  const fractionToNextCoupon = daysToNextCoupon / daysInPeriod;

  const dirtyPrice = dirtyPriceFromSemiannualYield(
    semiAnnualYield,
    semiAnnualCoupon,
    periodsRemaining,
    fractionToNextCoupon,
  );

  if (!Number.isFinite(dirtyPrice)) {
    return null;
  }

  return {
    cleanPrice: roundToInternalPrecision(dirtyPrice - accruedInterest),
    accruedInterest: roundToInternalPrecision(accruedInterest),
  };
}

function yieldFromCleanPrice(
  targetCleanPrice: number,
  couponPercent: number,
  settlement: ParsedDate,
  maturity: ParsedDate,
): number | null {
  const schedule = couponDatesAroundSettlement(maturity, settlement);
  if (!schedule) {
    return null;
  }

  const { previous, next } = schedule;
  const daysInPeriod = actualDaysBetween(previous, next);
  if (daysInPeriod <= 0) {
    return null;
  }

  const daysAccrued = actualDaysBetween(previous, settlement);
  const daysToNextCoupon = actualDaysBetween(settlement, next);
  const semiAnnualCoupon = couponPercent / 2;
  const accruedInterest = semiAnnualCoupon * (daysAccrued / daysInPeriod);
  const targetDirtyPrice = targetCleanPrice + accruedInterest;
  const periodsRemaining = countRemainingCoupons(next, maturity);
  const fractionToNextCoupon = daysToNextCoupon / daysInPeriod;

  let semiAnnualYield = 0.04;

  for (let iteration = 0; iteration < 50; iteration += 1) {
    const dirty = dirtyPriceFromSemiannualYield(
      semiAnnualYield,
      semiAnnualCoupon,
      periodsRemaining,
      fractionToNextCoupon,
    );

    const derivative =
      (dirtyPriceFromSemiannualYield(
        semiAnnualYield + 1e-6,
        semiAnnualCoupon,
        periodsRemaining,
        fractionToNextCoupon,
      ) -
        dirty) /
      1e-6;

    if (!Number.isFinite(dirty) || !Number.isFinite(derivative) || derivative === 0) {
      return null;
    }

    const step = (dirty - targetDirtyPrice) / derivative;
    semiAnnualYield -= step;

    if (Math.abs(step) < 1e-10) {
      return roundToInternalPrecision(semiAnnualYield * 200);
    }
  }

  return null;
}

function parseBondDates(
  settlementEncoded: number,
  maturityEncoded: number,
  dateFormat: DateFormat,
): { settlement: ParsedDate; maturity: ParsedDate } | null {
  const settlement = parseEncodedDate(settlementEncoded, dateFormat);
  const maturity = parseEncodedDate(maturityEncoded, dateFormat);

  if (!settlement || !maturity) {
    return null;
  }

  return { settlement, maturity };
}

/** f PRICE — clean price and accrued interest (actual/actual, semiannual). */
export function bondPriceFromYield(inputs: BondInputs): BondResult | null {
  if (inputs.yieldPercent === undefined || !Number.isFinite(inputs.yieldPercent)) {
    return null;
  }

  const dates = parseBondDates(
    inputs.settlementEncoded,
    inputs.maturityEncoded,
    inputs.dateFormat,
  );
  if (!dates) {
    return null;
  }

  const priced = cleanPriceFromYield(
    inputs.yieldPercent,
    inputs.couponPercent,
    dates.settlement,
    dates.maturity,
  );
  if (!priced) {
    return null;
  }

  return {
    cleanPrice: priced.cleanPrice,
    accruedInterest: priced.accruedInterest,
    yieldPercent: roundToInternalPrecision(inputs.yieldPercent),
  };
}

/** f YTM — yield to maturity from clean price. */
export function bondYieldFromPrice(inputs: BondInputs): BondResult | null {
  if (inputs.cleanPrice === undefined || !Number.isFinite(inputs.cleanPrice)) {
    return null;
  }

  const dates = parseBondDates(
    inputs.settlementEncoded,
    inputs.maturityEncoded,
    inputs.dateFormat,
  );
  if (!dates) {
    return null;
  }

  const yieldPercent = yieldFromCleanPrice(
    inputs.cleanPrice,
    inputs.couponPercent,
    dates.settlement,
    dates.maturity,
  );
  if (yieldPercent === null || !Number.isFinite(yieldPercent)) {
    return null;
  }

  const priced = cleanPriceFromYield(
    yieldPercent,
    inputs.couponPercent,
    dates.settlement,
    dates.maturity,
  );
  if (!priced) {
    return null;
  }

  return {
    cleanPrice: roundToInternalPrecision(inputs.cleanPrice),
    accruedInterest: priced.accruedInterest,
    yieldPercent,
  };
}
