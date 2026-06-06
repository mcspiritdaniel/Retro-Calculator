import { describe, expect, it } from "vitest";
import { bondPriceFromYield, bondYieldFromPrice } from "./bond";

const TREASURY_2018 = {
  settlementEncoded: 4.282004,
  maturityEncoded: 6.042018,
  dateFormat: "mdy" as const,
  couponPercent: 6.75,
};

describe("bond", () => {
  it("computes PRICE for the Treasury reference example at 8.25% yield", () => {
    const result = bondPriceFromYield({
      ...TREASURY_2018,
      yieldPercent: 8.25,
    });

    expect(result?.cleanPrice).toBeCloseTo(87.62, 2);
    expect(result?.accruedInterest).toBeCloseTo(2.69, 2);
    expect((result?.cleanPrice ?? 0) + (result?.accruedInterest ?? 0)).toBeCloseTo(
      90.31,
      2,
    );
  });

  it("computes PRICE for the reference example at 4.75% yield", () => {
    const result = bondPriceFromYield({
      ...TREASURY_2018,
      yieldPercent: 4.75,
    });

    expect(result?.cleanPrice).toBeCloseTo(120.38, 2);
  });

  it("computes YTM for the reference example at 88.38 price", () => {
    const result = bondYieldFromPrice({
      ...TREASURY_2018,
      cleanPrice: 88.38,
    });

    expect(result?.yieldPercent).toBeCloseTo(8.15, 2);
  });
});
