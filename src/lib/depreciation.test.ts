import { describe, expect, it } from "vitest";
import {
  decliningBalanceDepreciation,
  straightLineDepreciation,
  sumOfYearsDigitsDepreciation,
} from "./depreciation";

describe("depreciation", () => {
  it("computes straight-line depreciation", () => {
    const result = straightLineDepreciation({
      cost: 28000,
      salvage: 2500,
      life: 12,
      year: 1,
    });

    expect(result?.depreciation).toBeCloseTo(2125, 2);
    expect(result?.remainingDepreciable).toBeCloseTo(23375, 2);
  });

  it("computes declining-balance depreciation for the metalworking example", () => {
    const inputs = {
      cost: 10000,
      salvage: 500,
      life: 5,
      dbFactor: 200,
    };

    expect(decliningBalanceDepreciation({ ...inputs, year: 1 })?.depreciation).toBe(
      4000,
    );
    expect(
      decliningBalanceDepreciation({ ...inputs, year: 1 })?.remainingDepreciable,
    ).toBe(5500);
    expect(decliningBalanceDepreciation({ ...inputs, year: 2 })?.depreciation).toBe(
      2400,
    );
    expect(
      decliningBalanceDepreciation({ ...inputs, year: 2 })?.remainingDepreciable,
    ).toBe(3100);
    expect(decliningBalanceDepreciation({ ...inputs, year: 3 })?.depreciation).toBe(
      1440,
    );
    expect(
      decliningBalanceDepreciation({ ...inputs, year: 3 })?.remainingDepreciable,
    ).toBe(1660);
  });

  it("computes declining-balance depreciation for the R&D example", () => {
    const inputs = {
      cost: 28000,
      salvage: 2500,
      life: 12,
      dbFactor: 200,
    };

    expect(
      decliningBalanceDepreciation({ ...inputs, year: 5 })?.depreciation,
    ).toBeCloseTo(2250.52, 1);
    expect(
      decliningBalanceDepreciation({ ...inputs, year: 8 })?.depreciation,
    ).toBeCloseTo(1302.38, 2);
  });

  it("computes SOYD depreciation for the video equipment example", () => {
    const result = sumOfYearsDigitsDepreciation({
      cost: 15000,
      salvage: 1100,
      life: 8,
      year: 4,
    });

    expect(result?.depreciation).toBeCloseTo(1930.56, 2);
    expect(result?.remainingDepreciable).toBeCloseTo(3861.11, 1);
  });
});
