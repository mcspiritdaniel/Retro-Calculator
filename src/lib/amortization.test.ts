import { describe, expect, it } from "vitest";
import { amortizePayments, simpleInterest360 } from "./amortization";

describe("simpleInterest360", () => {
  it("matches the reference loan example", () => {
    expect(simpleInterest360(-450, 7, 60)).toBeCloseTo(5.25, 2);
  });
});

describe("amortizePayments", () => {
  it("amortizes the first monthly payment from the reference example", () => {
    const result = amortizePayments(
      50_000,
      -562.89,
      13.25 / 12,
      1,
      0,
      "end",
      2,
    );

    expect(result.totalInterest).toBeCloseTo(-552.08, 2);
    expect(result.totalPrincipal).toBeCloseTo(-10.81, 2);
    expect(result.remainingPv).toBeCloseTo(49_989.19, 2);
    expect(result.totalAmortizedPeriods).toBe(1);
  });

  it("amortizes the first twelve payments from the reference example", () => {
    const result = amortizePayments(
      50_000,
      -573.35,
      13.25 / 12,
      12,
      0,
      "end",
      2,
    );

    expect(result.totalInterest).toBeCloseTo(-6608.89, 2);
    expect(result.totalPrincipal).toBeCloseTo(-271.31, 2);
    expect(result.remainingPv).toBeCloseTo(49_728.69, 2);
    expect(result.totalAmortizedPeriods).toBe(12);
  });
});
