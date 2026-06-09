import { describe, expect, it } from "vitest";
import {
  DISPLAY_DIGIT_COUNT,
  formatFullMantissa,
  formatLcdDisplay,
  getLcdScientificLayout,
  formatLcdEntry,
  getLcdScientificEntryParts,
  shouldUseScientificNotation,
} from "./lcd-format";
import { roundToInternalPrecision } from "./number-precision";

describe("roundToInternalPrecision", () => {
  it("keeps values within 12 significant digits", () => {
    expect(roundToInternalPrecision(1.2345678901234)).toBe(1.23456789012);
    expect(roundToInternalPrecision(123456789012.3)).toBe(123456789012);
  });

  it("passes through non-finite values", () => {
    expect(roundToInternalPrecision(Number.NaN)).toBeNaN();
    expect(roundToInternalPrecision(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("formatLcdDisplay — standard notation", () => {
  it("formats everyday values with grouping and two decimals", () => {
    expect(
      formatLcdDisplay({
        value: 123456.78,
        isEntering: false,
        inputBuffer: "",
      }),
    ).toBe("123,456.78");
  });

  it("shows up to nine decimal places in standard notation when configured", () => {
    expect(
      formatLcdDisplay({
        value: 1.123456789,
        isEntering: false,
        inputBuffer: "",
        decimalPlaces: 9,
      }),
    ).toBe("1.123456789");
  });

  it("limits standard notation to ten digit characters", () => {
    expect(
      formatLcdDisplay({
        value: 123456789.12,
        isEntering: false,
        inputBuffer: "",
      }),
    ).toBe("1.234568 08");
  });
});

describe("formatLcdDisplay — scientific notation", () => {
  it("forces scientific notation for all values in SCI display mode", () => {
    expect(
      formatLcdDisplay({
        value: 123.45,
        isEntering: false,
        inputBuffer: "",
        decimalPlaces: 2,
        displayFormat: "sci",
      }),
    ).toBe("1.234500 02");
  });

  it("splits committed SCI values into mantissa and exponent for LCD layout", () => {
    expect(
      getLcdScientificLayout({
        value: 123.45,
        isEntering: false,
        inputBuffer: "",
        decimalPlaces: 2,
        displayFormat: "sci",
      }),
    ).toEqual({
      mantissa: "1.234500",
      exponentSign: " ",
      exponent: "02",
    });
  });

  it("uses scientific notation below the millionths place", () => {
    expect(
      formatLcdDisplay({
        value: 0.00000012,
        isEntering: false,
        inputBuffer: "",
      }),
    ).toBe("1.200000-07");
  });

  it("uses a seven-digit mantissa and two-digit exponent", () => {
    const text = formatLcdDisplay({
      value: -9876543210,
      isEntering: false,
      inputBuffer: "",
    });

    expect(text).toBe("-9.876543 09");
    expect(text.replace(/[^\d]/g, "").length).toBe(9);
  });

  it("switches to scientific when fixed notation would round to zero", () => {
    expect(shouldUseScientificNotation(0.0001, 2)).toBe(true);
    expect(
      formatLcdDisplay({
        value: 0.0001,
        isEntering: false,
        inputBuffer: "",
        decimalPlaces: 2,
      }),
    ).toBe("1.000000-04");
  });
});

describe("formatLcdEntry", () => {
  it("groups digits while entering without padding fractional zeros", () => {
    expect(formatLcdEntry("1234567")).toBe("1,234,567.");
  });

  it("shows a trailing decimal after whole-number entry", () => {
    expect(formatLcdEntry("5")).toBe("5.");
  });

  it("shows all typed fractional digits while entering", () => {
    expect(formatLcdEntry("0.00000012")).toBe("0.00000012");
    expect(formatLcdEntry("0.")).toBe("0.");
  });

  it("pads fractional zeros only after entry completes", () => {
    expect(
      formatLcdDisplay({
        value: 5,
        isEntering: true,
        inputBuffer: "5",
        decimalPlaces: 3,
      }),
    ).toBe("5.");
    expect(
      formatLcdDisplay({
        value: 5,
        isEntering: false,
        inputBuffer: "",
        decimalPlaces: 3,
      }),
    ).toBe("5.000");
  });
});

describe("formatFullMantissa", () => {
  it("shows all 10 digits for the reference example", () => {
    expect(formatFullMantissa(14.8745632)).toBe("1487456320");
  });

  it("shows zeros for zero", () => {
    expect(formatFullMantissa(0)).toBe("0000000000");
  });
});
describe("formatLcdScientificEntry", () => {
  it("right-aligns the exponent in the 10-digit display field", () => {
    expect(
      formatLcdDisplay({
        value: 5,
        isEntering: true,
        inputBuffer: "5",
        isEnteringExponent: true,
        exponentBuffer: "",
      }),
    ).toBe("5.      00");
  });

  it("keeps the trailing decimal on whole-number mantissas during EEX entry", () => {
    expect(getLcdScientificEntryParts("5", "", false).mantissa).toBe("5.");
  });

  it("shows mantissa and exponent while EEX entry is active", () => {
    expect(
      formatLcdDisplay({
        value: 1.7814,
        isEntering: true,
        inputBuffer: "1.7814",
        isEnteringExponent: true,
        exponentBuffer: "12",
      }),
    ).toBe("1.7814  12");
  });

  it("shows a negative exponent sign during entry", () => {
    expect(
      formatLcdDisplay({
        value: 0.0015,
        isEntering: true,
        inputBuffer: "1.5",
        isEnteringExponent: true,
        exponentBuffer: "3",
        exponentNegative: true,
      }),
    ).toBe("1.5    -03");
  });
});

describe("display limits", () => {
  it("documents the ten-digit standard display window", () => {
    expect(DISPLAY_DIGIT_COUNT).toBe(10);
  });
});
