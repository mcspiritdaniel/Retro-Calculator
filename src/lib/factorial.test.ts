import { describe, expect, it } from "vitest";
import { FACTORIAL_OVERFLOW, factorial } from "./factorial";

describe("factorial", () => {
  it("computes small factorials", () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(1)).toBe(1);
    expect(factorial(5)).toBe(120);
    expect(factorial(6)).toBe(720);
  });

  it("computes 69!", () => {
    expect(factorial(69)).toBeGreaterThan(factorial(68));
    expect(factorial(69)).toBeLessThan(FACTORIAL_OVERFLOW);
  });

  it("returns overflow for n > 69", () => {
    expect(factorial(70)).toBe(FACTORIAL_OVERFLOW);
    expect(factorial(100)).toBe(FACTORIAL_OVERFLOW);
  });

  it("rejects non-integers and negatives", () => {
    expect(Number.isNaN(factorial(-1))).toBe(true);
    expect(Number.isNaN(factorial(4.5))).toBe(true);
    expect(Number.isNaN(factorial(Number.NaN))).toBe(true);
  });
});
