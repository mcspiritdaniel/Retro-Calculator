import { roundToInternalPrecision } from "./number-precision";

/** Statistics registers R1–R6 plus count of x = 0 pairs. */
export type StatisticsRegisters = {
  n: number;
  sumX: number;
  sumX2: number;
  sumY: number;
  sumY2: number;
  sumXY: number;
  countXZero: number;
};

export function createEmptyStatistics(): StatisticsRegisters {
  return {
    n: 0,
    sumX: 0,
    sumX2: 0,
    sumY: 0,
    sumY2: 0,
    sumXY: 0,
    countXZero: 0,
  };
}

export function accumulatePair(
  stats: StatisticsRegisters,
  x: number,
  y: number,
): StatisticsRegisters {
  return {
    n: stats.n + 1,
    sumX: stats.sumX + x,
    sumX2: stats.sumX2 + x * x,
    sumY: stats.sumY + y,
    sumY2: stats.sumY2 + y * y,
    sumXY: stats.sumXY + x * y,
    countXZero: stats.countXZero + (x === 0 ? 1 : 0),
  };
}

export function removePair(
  stats: StatisticsRegisters,
  x: number,
  y: number,
): StatisticsRegisters {
  if (stats.n <= 0) {
    return createEmptyStatistics();
  }

  return {
    n: stats.n - 1,
    sumX: stats.sumX - x,
    sumX2: stats.sumX2 - x * x,
    sumY: stats.sumY - y,
    sumY2: stats.sumY2 - y * y,
    sumXY: stats.sumXY - x * y,
    countXZero: stats.countXZero - (x === 0 ? 1 : 0),
  };
}

/** Arithmetic mean of accumulated x-values. */
export function meanOfX(stats: StatisticsRegisters): number {
  if (stats.n === 0) {
    return Number.NaN;
  }

  return roundToInternalPrecision(stats.sumX / stats.n);
}

/** Sample standard deviation of accumulated x-values (n − 1 denominator). */
export function sampleStdDevOfX(stats: StatisticsRegisters): number {
  return sampleStdDev(stats.n, stats.sumX, stats.sumX2);
}

/** Arithmetic mean of accumulated y-values. */
export function meanOfY(stats: StatisticsRegisters): number {
  if (stats.n === 0) {
    return Number.NaN;
  }

  return roundToInternalPrecision(stats.sumY / stats.n);
}

/** Sample standard deviation of accumulated y-values (n − 1 denominator). */
export function sampleStdDevOfY(stats: StatisticsRegisters): number {
  return sampleStdDev(stats.n, stats.sumY, stats.sumY2);
}

/** Weighted mean with weights in x and values in y: Σ(xy) / Σ(x). */
export function weightedMean(stats: StatisticsRegisters): number {
  if (stats.sumX === 0) {
    return Number.NaN;
  }

  return roundToInternalPrecision(stats.sumXY / stats.sumX);
}

/** Pearson correlation coefficient for accumulated (x, y) pairs. */
export function correlationCoefficient(stats: StatisticsRegisters): number {
  const { n, sumX, sumX2, sumY, sumY2, sumXY } = stats;

  if (n <= 1) {
    return Number.NaN;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominatorX = n * sumX2 - sumX * sumX;
  const denominatorY = n * sumY2 - sumY * sumY;

  if (denominatorX <= 0 || denominatorY <= 0) {
    return Number.NaN;
  }

  return roundToInternalPrecision(
    numerator / Math.sqrt(denominatorX * denominatorY),
  );
}

function sampleStdDev(n: number, sum: number, sumSquares: number): number {
  if (n <= 1) {
    return 0;
  }

  const variance = (sumSquares - (sum * sum) / n) / (n - 1);
  if (variance < 0) {
    return 0;
  }

  return roundToInternalPrecision(Math.sqrt(variance));
}

function populationStdDev(n: number, sum: number, sumSquares: number): number {
  if (n <= 0) {
    return 0;
  }

  const variance = (sumSquares - (sum * sum) / n) / n;
  if (variance < 0) {
    return 0;
  }

  return roundToInternalPrecision(Math.sqrt(variance));
}

/** Population standard deviation of x-values (f + 0 on classic layouts). */
export function populationStdDevOfX(stats: StatisticsRegisters): number {
  return populationStdDev(stats.n, stats.sumX, stats.sumX2);
}

/** Population standard deviation of y-values (f + . on classic layouts). */
export function populationStdDevOfY(stats: StatisticsRegisters): number {
  return populationStdDev(stats.n, stats.sumY, stats.sumY2);
}

/** g + CLx (x=0) — count accumulated pairs where x equals zero. */
export function countZeroXValues(stats: StatisticsRegisters): number {
  return roundToInternalPrecision(stats.countXZero);
}

/** Least-squares slope B in y = A + Bx. */
export function linearRegressionSlope(stats: StatisticsRegisters): number {
  const { n, sumX, sumX2, sumY, sumXY } = stats;

  if (n <= 1) {
    return Number.NaN;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return Number.NaN;
  }

  return roundToInternalPrecision((n * sumXY - sumX * sumY) / denominator);
}

/** Least-squares intercept A in y = A + Bx. */
export function linearRegressionIntercept(stats: StatisticsRegisters): number {
  const slope = linearRegressionSlope(stats);
  if (!Number.isFinite(slope)) {
    return Number.NaN;
  }

  return roundToInternalPrecision(meanOfY(stats) - slope * meanOfX(stats));
}

/** Linear estimate ŷ = A + Bx for a given x-value. */
export function forecastY(stats: StatisticsRegisters, x: number): number {
  const slope = linearRegressionSlope(stats);
  const intercept = linearRegressionIntercept(stats);

  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) {
    return Number.NaN;
  }

  return roundToInternalPrecision(intercept + slope * x);
}

/** Linear estimate x̂ for a given y-value. */
export function forecastX(stats: StatisticsRegisters, y: number): number {
  const slope = linearRegressionSlope(stats);

  if (!Number.isFinite(slope) || slope === 0) {
    return Number.NaN;
  }

  const intercept = linearRegressionIntercept(stats);
  if (!Number.isFinite(intercept)) {
    return Number.NaN;
  }

  return roundToInternalPrecision((y - intercept) / slope);
}
