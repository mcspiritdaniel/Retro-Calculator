/** Maximum digit characters (0–9) shown in standard fixed notation. */
export const DISPLAY_DIGIT_COUNT = 10;

/** User-configurable display decimals (f + digit). */
export const MAX_DISPLAY_DECIMALS = 9;

export const DEFAULT_DISPLAY_DECIMALS = 2;

export type LcdDisplayFormat = "fix" | "sci";

/** Scientific notation: one leading digit, six after the decimal. */
export const SCIENTIFIC_MANTISSA_DIGITS = 7;

export const SCIENTIFIC_EXPONENT_DIGITS = 2;

export type LcdDisplayInput = {
  value: number;
  isEntering: boolean;
  inputBuffer: string;
  decimalPlaces?: number;
  displayFormat?: LcdDisplayFormat;
  isEnteringExponent?: boolean;
  exponentBuffer?: string;
  exponentNegative?: boolean;
};

function clampDecimalPlaces(decimalPlaces: number): number {
  return Math.max(0, Math.min(MAX_DISPLAY_DECIMALS, decimalPlaces));
}

/** Round to the active display precision (RND and AMORT interest steps). */
export function roundToDisplayDecimalPlaces(
  value: number,
  decimalPlaces: number,
): number {
  const decimals = clampDecimalPlaces(decimalPlaces);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function countDigits(text: string): number {
  return (text.match(/\d/g) ?? []).length;
}

function addThousandsGrouping(wholePart: string): string {
  return wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function roundToDisplay(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

function formatStandardFixed(value: number, decimalPlaces: number): string {
  const decimals = clampDecimalPlaces(decimalPlaces);
  const negative = value < 0;
  const rounded = roundToDisplay(Math.abs(value), decimals);
  const [whole, frac = ""] = rounded.toFixed(decimals).split(".");
  const grouped = addThousandsGrouping(whole);
  return `${negative ? "-" : ""}${grouped}.${frac}`;
}

/** Mantissa and exponent fields for committed scientific display (f . / auto-SCI). */
export function getLcdScientificDisplayParts(
  value: number,
): LcdScientificEntryParts {
  const negative = value < 0;
  const abs = Math.abs(value);
  const zeroMantissa = (0).toFixed(SCIENTIFIC_MANTISSA_DIGITS - 1);

  if (abs === 0) {
    return {
      mantissa: `${negative ? "-" : ""}${zeroMantissa}`,
      exponentSign: " ",
      exponent: "00",
    };
  }

  let exponent = Math.floor(Math.log10(abs));
  let mantissa = abs / 10 ** exponent;

  mantissa = Number(mantissa.toPrecision(SCIENTIFIC_MANTISSA_DIGITS));
  if (mantissa >= 10) {
    mantissa /= 10;
    exponent += 1;
  }

  exponent = Math.max(
    -(10 ** SCIENTIFIC_EXPONENT_DIGITS - 1),
    Math.min(10 ** SCIENTIFIC_EXPONENT_DIGITS - 1, exponent),
  );

  const mantissaText = mantissa.toFixed(SCIENTIFIC_MANTISSA_DIGITS - 1);

  return {
    mantissa: `${negative ? "-" : ""}${mantissaText}`,
    exponentSign: exponent < 0 ? "-" : " ",
    exponent: Math.abs(exponent)
      .toString()
      .padStart(SCIENTIFIC_EXPONENT_DIGITS, "0"),
  };
}

function formatScientific(value: number): string {
  const { mantissa, exponentSign, exponent } =
    getLcdScientificDisplayParts(value);
  return `${mantissa}${exponentSign}${exponent}`;
}

export function shouldUseScientificNotation(
  value: number,
  decimalPlaces: number,
): boolean {
  if (!Number.isFinite(value) || value === 0) {
    return false;
  }

  const abs = Math.abs(value);
  const effectiveDecimals = clampDecimalPlaces(decimalPlaces);

  if (abs < 10 ** -effectiveDecimals) {
    return true;
  }

  const rounded = roundToDisplay(value, effectiveDecimals);
  if (rounded === 0) {
    return true;
  }

  const standardText = formatStandardFixed(value, decimalPlaces);
  return countDigits(standardText) > DISPLAY_DIGIT_COUNT;
}

/** Mantissa field width on the 10-digit display (exponent uses sign + 2 digits). */
export const SCIENTIFIC_ENTRY_MANTISSA_WIDTH =
  DISPLAY_DIGIT_COUNT - SCIENTIFIC_EXPONENT_DIGITS - 1;

export type LcdScientificEntryParts = {
  mantissa: string;
  exponentSign: " " | "-";
  exponent: string;
};

function mantissaTextForScientificEntry(buffer: string): string {
  return formatLcdEntry(buffer);
}

export function getLcdScientificEntryParts(
  mantissaBuffer: string,
  exponentBuffer: string,
  exponentNegative: boolean,
): LcdScientificEntryParts {
  return {
    mantissa: mantissaTextForScientificEntry(mantissaBuffer),
    exponentSign: exponentNegative ? "-" : " ",
    exponent: exponentBuffer.padStart(SCIENTIFIC_EXPONENT_DIGITS, "0"),
  };
}

/** Live scientific entry while EEX is active (mantissa + 2-digit exponent field). */
export function formatLcdScientificEntry(
  mantissaBuffer: string,
  exponentBuffer: string,
  exponentNegative: boolean,
): string {
  const { mantissa, exponentSign, exponent } = getLcdScientificEntryParts(
    mantissaBuffer,
    exponentBuffer,
    exponentNegative,
  );
  const mantissaField = mantissa
    .padEnd(SCIENTIFIC_ENTRY_MANTISSA_WIDTH, " ")
    .slice(0, SCIENTIFIC_ENTRY_MANTISSA_WIDTH);

  return `${mantissaField}${exponentSign}${exponent}`;
}

export function formatLcdEntry(
  buffer: string,
  _decimalPlaces = DEFAULT_DISPLAY_DECIMALS,
): string {
  if (buffer === "" || buffer === "-") {
    return buffer === "-" ? "-" : "0.";
  }

  const negative = buffer.startsWith("-");
  const body = buffer.replace("-", "");

  if (body === ".") {
    return `${negative ? "-" : ""}0.`;
  }

  const [whole, frac = ""] = body.split(".");
  const grouped = addThousandsGrouping(whole);

  if (body.includes(".")) {
    return `${negative ? "-" : ""}${grouped}.${frac}`;
  }

  return `${negative ? "-" : ""}${grouped}.`;
}

/** f + ENTER (PREFIX) — all 10 mantissa digits of the value in register X. */
export function formatFullMantissa(value: number): string {
  if (!Number.isFinite(value)) {
    return " Error ";
  }

  if (value === 0) {
    return "0".padEnd(DISPLAY_DIGIT_COUNT, "0");
  }

  const digits = Math.abs(value)
    .toPrecision(10)
    .replace(/\D/g, "")
    .slice(0, DISPLAY_DIGIT_COUNT);

  return digits.padEnd(DISPLAY_DIGIT_COUNT, "0");
}

/**
 * Split mantissa / exponent for LCD overlay layout (EEX entry and committed SCI).
 * Returns null for fixed notation and in-progress mantissa-only entry.
 */
export function getLcdScientificLayout(
  input: LcdDisplayInput,
): LcdScientificEntryParts | null {
  if (input.isEntering) {
    if (input.isEnteringExponent) {
      return getLcdScientificEntryParts(
        input.inputBuffer,
        input.exponentBuffer ?? "",
        input.exponentNegative ?? false,
      );
    }

    return null;
  }

  if (!Number.isFinite(input.value)) {
    return null;
  }

  const decimals = clampDecimalPlaces(
    input.decimalPlaces ?? DEFAULT_DISPLAY_DECIMALS,
  );

  if (
    input.displayFormat === "sci" ||
    shouldUseScientificNotation(input.value, decimals)
  ) {
    return getLcdScientificDisplayParts(input.value);
  }

  return null;
}

export function formatLcdDisplay({
  value,
  isEntering,
  inputBuffer,
  decimalPlaces = DEFAULT_DISPLAY_DECIMALS,
  displayFormat = "fix",
  isEnteringExponent = false,
  exponentBuffer = "",
  exponentNegative = false,
}: LcdDisplayInput): string {
  const decimals = clampDecimalPlaces(decimalPlaces);

  if (isEntering) {
    if (isEnteringExponent) {
      return formatLcdScientificEntry(
        inputBuffer,
        exponentBuffer ?? "",
        exponentNegative ?? false,
      );
    }

    return formatLcdEntry(inputBuffer, decimals);
  }

  if (!Number.isFinite(value)) {
    return " Error ";
  }

  if (displayFormat === "sci" || shouldUseScientificNotation(value, decimals)) {
    return formatScientific(value);
  }

  return formatStandardFixed(value, decimals);
}
