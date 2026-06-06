import { describe, expect, it } from "vitest";
import { solveFv, solvePmt, solveTvm } from "./tvm-solver";

describe("tvm-solver — BEG payment mode", () => {
  const tutorialState = { n: 36, i: 1, pv: 0, pmt: 100, fv: 0 };

  it("matches the END-mode future value reference example", () => {
    expect(solveFv(tutorialState, "end")).toBeCloseTo(-4307.69, 1);
  });

  it("matches the BEG-mode future value reference example", () => {
    expect(solveFv(tutorialState, "beg")).toBeCloseTo(-4350.76, 1);
  });

  it("produces a smaller payment magnitude in BEG mode for the same loan", () => {
    const loan = { n: 30, i: 5, pv: -10000, pmt: 0, fv: 0 };
    const endPmt = solvePmt(loan, "end");
    const begPmt = solvePmt(loan, "beg");

    expect(endPmt).toBeCloseTo(650.514351, 3);
    expect(Math.abs(begPmt)).toBeLessThan(Math.abs(endPmt));
  });

  it("routes payment mode through solveTvm", () => {
    expect(solveTvm("fv", tutorialState, "beg")).toBeCloseTo(-4350.76, 1);
  });

  it("rounds fractional n up to the next integer (HP-12C log cabin loan)", () => {
    const logCabin = { n: 0, i: 10.5 / 12, pv: 35000, pmt: -325, fv: 0 };

    expect(solveTvm("n", logCabin, "end")).toBe(328);
  });
});
