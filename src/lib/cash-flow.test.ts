import { describe, expect, it } from "vitest";
import {
  computeIrr,
  computeNpv,
  computeNpvFromRegisters,
  expandCashFlows,
} from "./cash-flow";

describe("expandCashFlows", () => {
  it("repeats each amount by its Nj count", () => {
    expect(expandCashFlows([-1000, 400], [1, 2])).toEqual([-1000, 400, 400]);
  });
});

describe("computeNpv", () => {
  it("returns 0 for an empty cash-flow series", () => {
    expect(computeNpv([], 10)).toBe(0);
  });

  it("leaves CF₀ undiscounted", () => {
    expect(computeNpv([-1000], 10)).toBe(-1000);
  });

  it("discounts subsequent flows by the interest rate in i", () => {
    const npv = computeNpv([-1000, 500, 600], 10);
    expect(npv).toBeCloseTo(-49.586777, 6);
  });
});

describe("computeNpvFromRegisters", () => {
  it("expands Nj counts before discounting", () => {
    const npv = computeNpvFromRegisters([-1000, 400], [1, 2], 10);
    expect(npv).toBeCloseTo(-305.785124, 4);
  });
});

describe("computeIrr", () => {
  it("solves IRR for a classic three-period cash-flow series", () => {
    const irr = computeIrr([-1000, 500, 600], [1, 1, 1], 10);
    expect(irr).toBeCloseTo(6.394103, 4);
    expect(computeNpv([-1000, 500, 600], irr)).toBeCloseTo(0, 4);
  });

  it("returns NaN when expanded flows do not change sign", () => {
    expect(computeIrr([-100, -200], [1, 1], 10)).toBeNaN();
  });
});
