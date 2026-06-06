import { describe, expect, it } from "vitest";
import {
  accumulatePair,
  correlationCoefficient,
  createEmptyStatistics,
  forecastX,
  forecastY,
  linearRegressionIntercept,
  linearRegressionSlope,
  meanOfX,
  meanOfY,
  removePair,
  sampleStdDevOfX,
  sampleStdDevOfY,
  statisticsRegisterValue,
  weightedMean,
} from "./statistics";

describe("statistics accumulators", () => {
  it("accumulates one-variable data points", () => {
    let stats = createEmptyStatistics();

    for (const value of [2, 4, 6]) {
      stats = accumulatePair(stats, value, 0);
    }

    expect(stats.n).toBe(3);
    expect(stats.sumX).toBe(12);
    expect(stats.sumX2).toBe(56);
    expect(meanOfX(stats)).toBe(4);
    expect(sampleStdDevOfX(stats)).toBe(2);
  });

  it("accumulates two-variable pairs", () => {
    let stats = createEmptyStatistics();
    stats = accumulatePair(stats, 3, 10);
    stats = accumulatePair(stats, 5, 20);

    expect(stats.n).toBe(2);
    expect(stats.sumX).toBe(8);
    expect(stats.sumY).toBe(30);
    expect(stats.sumXY).toBe(130);
  });

  it("removes a previously accumulated pair", () => {
    let stats = createEmptyStatistics();

    for (const value of [2, 4, 6]) {
      stats = accumulatePair(stats, value, 0);
    }

    stats = removePair(stats, 4, 0);

    expect(stats.n).toBe(2);
    expect(meanOfX(stats)).toBe(4);
    expect(sampleStdDevOfX(stats)).toBeCloseTo(2.828427, 5);
  });

  it("computes weighted mean from value/weight pairs", () => {
    let stats = createEmptyStatistics();
    stats = accumulatePair(stats, 15, 1.16);
    stats = accumulatePair(stats, 7, 1.24);
    stats = accumulatePair(stats, 10, 1.2);
    stats = accumulatePair(stats, 17, 1.18);

    expect(weightedMean(stats)).toBeCloseTo(1.19, 2);
  });

  it("maps statistics registers R1 through R6", () => {
    const stats = {
      n: 3,
      sumX: 12,
      sumX2: 56,
      sumY: 30,
      sumY2: 200,
      sumXY: 130,
      countXZero: 0,
    };

    expect(statisticsRegisterValue(1, stats)).toBe(3);
    expect(statisticsRegisterValue(2, stats)).toBe(12);
    expect(statisticsRegisterValue(6, stats)).toBe(130);
    expect(statisticsRegisterValue(7, stats)).toBeNull();
  });

  it("computes linear regression for the reference example", () => {
    let stats = createEmptyStatistics();
    stats = accumulatePair(stats, 0, 0);
    stats = accumulatePair(stats, 4, 6);

    expect(linearRegressionIntercept(stats)).toBe(0);
    expect(linearRegressionSlope(stats)).toBe(1.5);
    expect(forecastY(stats, 4)).toBe(6);
    expect(forecastX(stats, 6)).toBe(4);
    expect(correlationCoefficient(stats)).toBe(1);
  });
});
