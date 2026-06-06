import { roundToInternalPrecision } from "./number-precision";

export type DepreciationInputs = {
  cost: number;
  salvage: number;
  life: number;
  year: number;
  /** Declining-balance factor as a percent (e.g. 200 for 200%). */
  dbFactor?: number;
};

export type DepreciationResult = {
  depreciation: number;
  /** Remaining depreciable value (book value minus salvage) after the year. */
  remainingDepreciable: number;
};

function validateInputs({
  cost,
  salvage,
  life,
  year,
}: DepreciationInputs): boolean {
  if (
    !Number.isFinite(cost) ||
    !Number.isFinite(salvage) ||
    !Number.isFinite(life) ||
    !Number.isFinite(year)
  ) {
    return false;
  }

  const lifeYears = Math.trunc(life);
  const period = Math.trunc(year);

  if (lifeYears <= 0 || period <= 0 || cost < salvage) {
    return false;
  }

  return lifeYears === life && period === year;
}

/** Straight-line depreciation for year j. */
export function straightLineDepreciation(
  inputs: DepreciationInputs,
): DepreciationResult | null {
  if (!validateInputs(inputs)) {
    return null;
  }

  const { cost, salvage, life, year } = inputs;
  const annual = (cost - salvage) / life;

  let bookValue = cost;

  for (let period = 1; period <= Math.min(year, life); period += 1) {
    const dep = Math.min(annual, bookValue - salvage);
    bookValue -= dep;

    if (period === year) {
      return {
        depreciation: roundToInternalPrecision(dep),
        remainingDepreciable: roundToInternalPrecision(
          Math.max(0, bookValue - salvage),
        ),
      };
    }
  }

  return {
    depreciation: 0,
    remainingDepreciable: roundToInternalPrecision(Math.max(0, bookValue - salvage)),
  };
}

/** Sum-of-the-years-digits depreciation for year j. */
export function sumOfYearsDigitsDepreciation(
  inputs: DepreciationInputs,
): DepreciationResult | null {
  if (!validateInputs(inputs)) {
    return null;
  }

  const { cost, salvage, life, year } = inputs;
  const depreciable = cost - salvage;
  const denominator = (life * (life + 1)) / 2;

  let bookValue = cost;

  for (let period = 1; period <= Math.min(year, life); period += 1) {
    const weight = life - period + 1;
    const dep = Math.min(
      (depreciable * weight) / denominator,
      bookValue - salvage,
    );
    bookValue -= dep;

    if (period === year) {
      return {
        depreciation: roundToInternalPrecision(dep),
        remainingDepreciable: roundToInternalPrecision(
          Math.max(0, bookValue - salvage),
        ),
      };
    }
  }

  return {
    depreciation: 0,
    remainingDepreciable: roundToInternalPrecision(Math.max(0, bookValue - salvage)),
  };
}

/** Declining-balance depreciation for year j. */
export function decliningBalanceDepreciation(
  inputs: DepreciationInputs,
): DepreciationResult | null {
  if (!validateInputs(inputs)) {
    return null;
  }

  const factor = inputs.dbFactor;
  if (factor === undefined || !Number.isFinite(factor) || factor <= 0) {
    return null;
  }

  const { cost, salvage, life, year } = inputs;
  const rate = factor / 100 / life;

  let bookValue = cost;

  for (let period = 1; period <= Math.min(year, life); period += 1) {
    const dep = Math.min(bookValue * rate, bookValue - salvage);
    bookValue -= dep;

    if (period === year) {
      return {
        depreciation: roundToInternalPrecision(dep),
        remainingDepreciable: roundToInternalPrecision(
          Math.max(0, bookValue - salvage),
        ),
      };
    }
  }

  return {
    depreciation: 0,
    remainingDepreciable: roundToInternalPrecision(Math.max(0, bookValue - salvage)),
  };
}
