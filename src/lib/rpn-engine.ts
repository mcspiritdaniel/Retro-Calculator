/**
 * Classic RPN financial calculator engine.
 *
 * Stack conventions match the original hardware layout:
 * - X is the display register; binary ops use Y and X (e.g. subtraction is Y − X).
 * - ENTER performs a stack lift: T←Z, Z←Y, Y←X (X unchanged), duplicating X into Y.
 * - Binary ops stack-drop into X; Y←Z, Z←T, and T duplicates itself (T←T).
 * - lastX captures X immediately before any binary operation (for LSTx recovery).
 * - TVM uses PV + PMT·aₙ + FV·(1+i)⁻ⁿ = 0 with i stored as a percent (5 = 5%).
 */

import { bondPriceFromYield, bondYieldFromPrice } from "./bond";
import {
  decliningBalanceDepreciation,
  straightLineDepreciation,
  sumOfYearsDigitsDepreciation,
} from "./depreciation";
import { factorial } from "./factorial";
import { amortizePayments, simpleInterest360, simpleInterest365 } from "./amortization";
import {
  addDaysToDate,
  daysBetweenDates,
  formatCalendarDate,
  type DateFormat,
} from "./calendar";
import { computeIrr, computeNpvFromRegisters } from "./cash-flow";
import { DEFAULT_DISPLAY_DECIMALS, formatFullMantissa, roundToDisplayDecimalPlaces, SCIENTIFIC_EXPONENT_DIGITS } from "./lcd-format";
import {
  accumulatePair,
  applyStatisticsRegisterValue,
  countZeroXValues,
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
  type StatisticsRegisters,
} from "./statistics";
import {
  solveTvm,
  type FinancialRegisters,
  type PaymentMode,
  type TvmRegister,
} from "./tvm-solver";
import { roundToInternalPrecision } from "./number-precision";

export const DISPLAY_INPUT_DIGIT_LIMIT = 10;
export const STORAGE_REGISTER_COUNT = 10;

export type { FinancialRegisters, StatisticsRegisters, DateFormat };

export type MemoryPrefix = "sto" | "rcl";

export type StackRegisters = {
  x: number;
  y: number;
  z: number;
  t: number;
};

export type RpnEngineSnapshot = {
  stack: StackRegisters;
  lastX: number;
  fShift: boolean;
  gShift: boolean;
  decimalPlaces: number;
  financial: FinancialRegisters;
  cashFlows: number[];
  cashFlowCounts: number[];
  statistics: StatisticsRegisters;
  dateFormat: DateFormat;
  storage: number[];
  memoryPrefix: MemoryPrefix | null;
  paymentMode: PaymentMode;
  stackLiftEnabled: boolean;
  inputBuffer: string;
  isEntering: boolean;
  isEnteringExponent: boolean;
  exponentBuffer: string;
  exponentNegative: boolean;
};

function parseInputBuffer(buffer: string): number {
  if (buffer === "" || buffer === "-" || buffer === "." || buffer === "-.") {
    return 0;
  }

  const value = parseFloat(buffer);
  return Number.isNaN(value) ? 0 : value;
}

function numberToMantissaBuffer(value: number): string {
  const rounded = roundToInternalPrecision(value);

  if (rounded === 0) {
    return "0";
  }

  if (!Number.isFinite(rounded)) {
    return "0";
  }

  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  const fixed = abs.toFixed(12).replace(/\.?0+$/, "");

  return `${sign}${fixed || "0"}`;
}

function parseScientificEntry(
  mantissaBuffer: string,
  exponentBuffer: string,
  exponentNegative: boolean,
): number {
  const mantissa = parseInputBuffer(mantissaBuffer);
  const exponentDigits =
    exponentBuffer === "" || exponentBuffer === "-"
      ? 0
      : parseInt(exponentBuffer, 10);
  const exponent = exponentNegative ? -exponentDigits : exponentDigits;

  return roundToInternalPrecision(mantissa * 10 ** exponent);
}

export class RpnEngine {
  private stack: StackRegisters = { x: 0, y: 0, z: 0, t: 0 };

  private inputBuffer = "";
  private isEntering = false;
  private isEnteringExponent = false;
  private exponentBuffer = "";
  private exponentNegative = false;

  lastX = 0;

  /** f (gold) shift key — alters the function printed above a key. */
  fShift = false;

  /** g (blue) shift key — alters the function printed below a key. */
  gShift = false;

  /** Fixed decimal places for display (f + digit on the faceplate). */
  decimalPlaces = DEFAULT_DISPLAY_DECIMALS;

  /**
   * When true, the next number entry will auto-lift the stack before accepting digits.
   * Cleared by ENTER; set again after binary operations.
   */
  stackLiftEnabled = false;

  /** Core TVM / financial registers ($n$, $i$, $PV$, $PMT$, $FV$). */
  financial: FinancialRegisters = {
    n: 0,
    i: 0,
    pv: 0,
    pmt: 0,
    fv: 0,
  };

  /** Cash-flow series for NPV (CF₀, CFⱼ, …). */
  cashFlows: number[] = [];

  /** Nj repetition count for each stored cash-flow amount (default 1). */
  cashFlowCounts: number[] = [];

  /** Statistics accumulators (registers R1–R6). */
  statistics: StatisticsRegisters = createEmptyStatistics();

  /** Set after g + . or g + 0; the next x↔y shows the paired y-statistic. */
  private pendingStatAlternate:
    | "meanY"
    | "stdDevY"
    | "correlation"
    | "days360"
    | null = null;

  /** M.DY (default) or D.MY date entry format for calendar functions. */
  dateFormat: DateFormat = "mdy";

  /** When true, the LCD shows a calendar date with weekday from DATE. */
  private calendarResultActive = false;

  /** When true, the LCD shows all 10 mantissa digits (f + ENTER / PREFIX). */
  private prefixMantissaActive = false;

  /** General-purpose storage registers 0–9 (R0–R9). */
  private storage: number[] = Array(STORAGE_REGISTER_COUNT).fill(0);

  /** Set after STO or RCL; next digit 0–9 completes the operation. */
  private memoryPrefix: MemoryPrefix | null = null;

  /** TVM payment timing: END (ordinary annuity) or BEG (annuity due). */
  paymentMode: PaymentMode = "end";

  /** Active display value (register X). */
  get display(): number {
    return this.stack.x;
  }

  getInputBuffer(): string {
    return this.inputBuffer;
  }

  getIsEntering(): boolean {
    return this.isEntering;
  }

  getIsEnteringExponent(): boolean {
    return this.isEnteringExponent;
  }

  getExponentBuffer(): string {
    return this.exponentBuffer;
  }

  getExponentNegative(): boolean {
    return this.exponentNegative;
  }

  getStack(): Readonly<StackRegisters> {
    return { ...this.stack };
  }

  getStorage(): readonly number[] {
    return [...this.storage];
  }

  getMemoryPrefix(): MemoryPrefix | null {
    return this.memoryPrefix;
  }

  getStatistics(): StatisticsRegisters {
    return { ...this.statistics };
  }

  getDateFormat(): DateFormat {
    return this.dateFormat;
  }

  getShowDmyAnnunciator(): boolean {
    return this.dateFormat === "dmy";
  }

  getCalendarDisplayText(): string | null {
    if (this.calendarResultActive && !this.isEntering && !this.isEnteringExponent) {
      return formatCalendarDate(this.stack.x, this.stack.y, this.dateFormat);
    }

    return null;
  }

  getPrefixMantissaDisplayText(): string | null {
    if (
      this.prefixMantissaActive &&
      !this.isEntering &&
      !this.isEnteringExponent
    ) {
      return formatFullMantissa(this.stack.x);
    }

    return null;
  }

  getSnapshot(): RpnEngineSnapshot {
    return {
      stack: this.getStack(),
      lastX: this.lastX,
      fShift: this.fShift,
      gShift: this.gShift,
      decimalPlaces: this.decimalPlaces,
      financial: { ...this.financial },
      cashFlows: [...this.cashFlows],
      cashFlowCounts: [...this.cashFlowCounts],
      statistics: { ...this.statistics },
      dateFormat: this.dateFormat,
      storage: [...this.getStorage()],
      memoryPrefix: this.memoryPrefix,
      paymentMode: this.paymentMode,
      stackLiftEnabled: this.stackLiftEnabled,
      inputBuffer: this.inputBuffer,
      isEntering: this.isEntering,
      isEnteringExponent: this.isEnteringExponent,
      exponentBuffer: this.exponentBuffer,
      exponentNegative: this.exponentNegative,
    };
  }

  reset(): void {
    this.stack = { x: 0, y: 0, z: 0, t: 0 };
    this.lastX = 0;
    this.fShift = false;
    this.gShift = false;
    this.decimalPlaces = DEFAULT_DISPLAY_DECIMALS;
    this.stackLiftEnabled = false;
    this.financial = { n: 0, i: 0, pv: 0, pmt: 0, fv: 0 };
    this.cashFlows = [];
    this.cashFlowCounts = [];
    this.statistics = createEmptyStatistics();
    this.dateFormat = "mdy";
    this.calendarResultActive = false;
    this.prefixMantissaActive = false;
    this.storage = Array(STORAGE_REGISTER_COUNT).fill(0);
    this.clearMemoryPrefix();
    this.endEntry();
  }

  /** Directly set register X (useful for tests and programmatic input). */
  setX(value: number): void {
    this.stack.x = roundToInternalPrecision(value);
    this.endEntry();
  }

  /** Seed the full stack (test helper). */
  setStack(stack: StackRegisters): void {
    this.stack = { ...stack };
    this.endEntry();
  }

  /**
   * Stack lift — copies X into Y and rolls Y→Z, Z→T.
   * Register X is left unchanged; the former T value is replaced by Z.
   */
  lift(): void {
    const { x, y, z } = this.stack;
    this.stack = { x, y: x, z: y, t: z };
  }

  /**
   * Stack drop after a binary operation.
   * Result lands in X; Y←Z, Z←T; T duplicates itself.
   */
  drop(result: number): void {
    const { z, t } = this.stack;
    this.stack = { x: result, y: z, z: t, t };
  }

  /**
   * R↓ — roll the stack down toward X.
   * Y→X, Z→Y, T→Z, X→T. Next digit entry replaces X without lifting.
   */
  rollDown(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    const { x, y, z, t } = this.stack;
    this.stack = { x: y, y: z, z: t, t: x };
    this.stackLiftEnabled = false;
  }

  /**
   * ENTER — separates two numbers on the stack.
   * Lifts the stack and disables auto-lift until the next operation completes.
   */
  enter(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.lift();
    this.stackLiftEnabled = false;
  }

  /**
   * Routes the ENTER key: g+LSTx, f+PREFIX (mantissa / cancel prefix), or stack ENTER.
   */
  pressEnter(): void {
    if (this.fShift) {
      this.prefix();
      return;
    }

    if (this.gShift) {
      this.lstX();
      return;
    }

    this.enter();
  }

  /** f + ENTER (PREFIX) — cancel shift/memory prefix; show full mantissa of X. */
  private prefix(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.fShift = false;
    this.gShift = false;
    this.prefixMantissaActive = true;
    this.stackLiftEnabled = true;
  }

  /**
   * x↔y — exchange X and Y. Next digit entry replaces X without lifting.
   */
  swapXy(): void {
    if (this.fShift) {
      this.fin();
      this.fShift = false;
      this.clearMemoryPrefix();
      return;
    }

    if (this.pendingStatAlternate === "stdDevY") {
      this.endEntry();
      this.clearMemoryPrefix();
      this.stack.x = sampleStdDevOfY(this.statistics);
      this.pendingStatAlternate = null;
      this.stackLiftEnabled = true;
      return;
    }

    if (this.pendingStatAlternate === "meanY") {
      this.endEntry();
      this.clearMemoryPrefix();
      this.stack.x = meanOfY(this.statistics);
      this.pendingStatAlternate = null;
      this.stackLiftEnabled = true;
      return;
    }

    if (this.pendingStatAlternate === "correlation") {
      this.endEntry();
      this.clearMemoryPrefix();
      this.stack.x = correlationCoefficient(this.statistics);
      this.pendingStatAlternate = null;
      this.stackLiftEnabled = true;
      return;
    }

    if (this.pendingStatAlternate === "days360") {
      this.endEntry();
      this.clearMemoryPrefix();
      this.stack.x = roundToInternalPrecision(this.stack.y);
      this.pendingStatAlternate = null;
      this.stackLiftEnabled = true;
      return;
    }

    if (this.gShift) {
      this.endEntry();
      this.clearMemoryPrefix();
      this.stack.x = roundToInternalPrecision(this.stack.x <= this.stack.y ? 1 : 0);
      this.gShift = false;
      this.stackLiftEnabled = true;
      return;
    }

    this.endEntry();
    this.clearMemoryPrefix();
    const { x, y, z, t } = this.stack;
    this.stack = { x: y, y: x, z, t };
    this.stackLiftEnabled = false;
  }

  /**
   * LSTx — lift stack, then recall lastX into X (g + ENTER).
   */
  lstX(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.lift();
    this.stack.x = roundToInternalPrecision(this.lastX);
    this.gShift = false;
    this.stackLiftEnabled = false;
  }

  /**
   * Begin entering a new number into X.
   * Auto-lifts when stackLiftEnabled (after a prior op or completed entry).
   */
  beginNumberEntry(value: number): void {
    if (this.stackLiftEnabled) {
      this.lift();
    }
    this.stack.x = value;
    this.stackLiftEnabled = false;
    this.endEntry();
  }

  /**
   * STO — arm storage; the next digit 0–9 stores X into that register.
   */
  pressSto(): void {
    this.endEntry();
    this.memoryPrefix = "sto";
  }

  /**
   * RCL — arm recall; the next digit 0–9 recalls that register into X.
   */
  pressRcl(): void {
    this.endEntry();
    this.memoryPrefix = "rcl";
  }

  /** Append a digit to the active number entry buffer and sync register X. */
  pressDigit(digit: string): void {
    if (!/^\d$/.test(digit)) {
      return;
    }

    if (this.isEnteringExponent) {
      if (this.exponentBuffer.replace(/\D/g, "").length >= SCIENTIFIC_EXPONENT_DIGITS) {
        return;
      }

      this.exponentBuffer += digit;
      this.commitBufferToX();
      return;
    }

    const register = parseInt(digit, 10);

    if (this.gShift && digit === "7") {
      this.setPaymentMode("beg");
      return;
    }

    if (this.gShift && digit === "8") {
      this.setPaymentMode("end");
      return;
    }

    if (this.gShift && digit === "0") {
      this.recallMeanOfX();
      return;
    }

    if (this.gShift && digit === "1") {
      this.recallCorrelationCoefficient();
      return;
    }

    if (this.gShift && digit === "2") {
      this.recallMeanOfY();
      return;
    }

    if (this.gShift && digit === "3") {
      this.factorialX();
      return;
    }

    if (this.gShift && digit === "9") {
      this.showProgramMemoryRemaining();
      return;
    }

    if (this.gShift && digit === "4") {
      this.setDateFormatDmy();
      return;
    }

    if (this.gShift && digit === "5") {
      this.setDateFormatMdy();
      return;
    }

    if (this.gShift && digit === "6") {
      this.recallWeightedMean();
      return;
    }

    if (this.memoryPrefix === "sto") {
      this.storeToRegister(register);
      return;
    }

    if (this.memoryPrefix === "rcl") {
      this.recallFromRegister(register);
      return;
    }

    if (this.fShift) {
      if (this.isEntering || this.isEnteringExponent) {
        this.commitBufferToX();
        this.endEntry();
        this.stackLiftEnabled = false;
      }

      this.clearMemoryPrefix();
      this.decimalPlaces = parseInt(digit, 10);
      this.fShift = false;
      return;
    }

    this.startEntryIfNeeded();

    if (
      (this.inputBuffer === "0" || this.inputBuffer === "-0") &&
      !this.inputBuffer.includes(".")
    ) {
      const negative = this.inputBuffer.startsWith("-");
      this.inputBuffer = `${negative ? "-" : ""}${digit}`;
    } else {
      const digitCount = this.inputBuffer.replace(/\D/g, "").length;
      if (digitCount >= DISPLAY_INPUT_DIGIT_LIMIT) {
        return;
      }
      this.inputBuffer += digit;
    }

    this.commitBufferToX();
  }

  /** Append a decimal point, rejecting multiple decimals in one number. */
  pressDecimal(): void {
    if (this.isEnteringExponent) {
      return;
    }

    if (this.gShift) {
      this.recallSampleStdDevOfX();
      return;
    }

    this.startEntryIfNeeded();

    if (this.inputBuffer.includes(".")) {
      return;
    }

    if (this.inputBuffer === "" || this.inputBuffer === "-") {
      this.inputBuffer += this.inputBuffer === "-" ? "0." : "0.";
    } else {
      this.inputBuffer += ".";
    }

    this.commitBufferToX();
  }

  /**
   * CHS — change sign.
   * While entering a number, toggles the sign on the buffer.
   * During exponent entry, toggles the exponent sign.
   * Otherwise inverts the committed value in register X.
   */
  chs(): void {
    if (this.gShift) {
      this.addDaysToDate();
      return;
    }

    if (this.isEnteringExponent) {
      this.exponentNegative = !this.exponentNegative;
      this.commitBufferToX();
      return;
    }

    if (this.isEntering) {
      if (this.inputBuffer.startsWith("-")) {
        this.inputBuffer = this.inputBuffer.slice(1) || "0";
      } else {
        this.inputBuffer = this.inputBuffer ? `-${this.inputBuffer}` : "-0";
      }
      this.commitBufferToX();
      return;
    }

    this.stack.x = roundToInternalPrecision(-this.stack.x);
    this.clearMemoryPrefix();
  }

  /**
   * EEX — enter exponent. Mantissa comes from the active entry buffer or register X.
   * Subsequent digits set the power of ten (integer, up to two digits).
   */
  pressEex(): void {
    if (this.gShift) {
      this.deltaDaysBetween();
      return;
    }

    this.clearMemoryPrefix();

    if (!this.isEntering) {
      if (this.stackLiftEnabled) {
        this.lift();
      }

      this.inputBuffer = numberToMantissaBuffer(this.stack.x);
      this.isEntering = true;
      this.stackLiftEnabled = false;
    }

    this.isEnteringExponent = true;
    this.exponentBuffer = "";
    this.exponentNegative = false;
    this.commitBufferToX();
  }

  /** Delete the last typed digit while entering a number. */
  backspace(): void {
    if (!this.isEntering) {
      return;
    }

    if (
      this.inputBuffer.length <= 1 ||
      (this.inputBuffer.length === 2 && this.inputBuffer.startsWith("-"))
    ) {
      this.inputBuffer = "0";
    } else {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
    }

    this.commitBufferToX();
  }

  /** FIN — clear all TVM registers and cash flows (f + x↔y on the faceplate). */
  fin(): void {
    this.financial = { n: 0, i: 0, pv: 0, pmt: 0, fv: 0 };
    this.cashFlows = [];
    this.cashFlowCounts = [];
  }

  /** REG — master clear: storage, financial, stack, LAST X, and display (f + CLx). */
  clearReg(): void {
    this.stack = { x: 0, y: 0, z: 0, t: 0 };
    this.lastX = 0;
    this.storage = Array(STORAGE_REGISTER_COUNT).fill(0);
    this.financial = { n: 0, i: 0, pv: 0, pmt: 0, fv: 0 };
    this.cashFlows = [];
    this.endEntry();
    this.stackLiftEnabled = false;
  }

  /** CLX — clear register X without disturbing Y, Z, or T. */
  clx(): void {
    if (this.fShift) {
      this.clearReg();
      this.fShift = false;
      this.clearMemoryPrefix();
      return;
    }

    if (this.gShift) {
      this.endEntry();
      this.clearMemoryPrefix();
      this.stack.x = countZeroXValues(this.statistics);
      this.gShift = false;
      this.stackLiftEnabled = true;
      return;
    }

    this.clearMemoryPrefix();
    this.stack.x = 0;
    this.endEntry();
  }

  pressTvmN(): void {
    if (this.fShift) {
      this.amortize();
      return;
    }

    if (this.gShift) {
      this.applyAnnualToPeriodic("n", (value) => value * 12);
      return;
    }

    this.handleTvmKey("n");
  }

  pressTvmI(): void {
    if (this.fShift) {
      this.simpleInterest();
      return;
    }

    if (this.gShift) {
      this.applyAnnualToPeriodic("i", (value) => value / 12);
      return;
    }

    this.handleTvmKey("i");
  }

  pressTvmPv(): void {
    if (this.fShift) {
      this.computeNpv();
      return;
    }

    if (this.gShift) {
      this.setCf0();
      return;
    }

    this.handleTvmKey("pv");
  }

  pressTvmPmt(): void {
    if (this.fShift) {
      this.rnd();
      return;
    }

    if (this.gShift) {
      this.appendCfj();
      return;
    }

    this.handleTvmKey("pmt");
  }

  pressTvmFv(): void {
    if (this.fShift) {
      this.computeIrr();
      return;
    }

    if (this.gShift) {
      this.setNj();
      return;
    }

    this.handleTvmKey("fv");
  }

  private applyAnnualToPeriodic(
    register: "n" | "i",
    transform: (value: number) => number,
  ): void {
    this.endEntry();
    this.clearMemoryPrefix();
    const value = roundToInternalPrecision(transform(this.stack.x));
    this.financial[register] = value;
    this.stack.x = value;
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private setCf0(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.cashFlows = [roundToInternalPrecision(this.stack.x)];
    this.cashFlowCounts = [1];
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private appendCfj(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.cashFlows.push(roundToInternalPrecision(this.stack.x));
    this.cashFlowCounts.push(1);
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private setNj(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    if (this.cashFlows.length === 0) {
      this.gShift = false;
      return;
    }

    const repetitions = Math.max(0, Math.trunc(this.stack.x));
    this.cashFlowCounts[this.cashFlowCounts.length - 1] = repetitions;
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private computeNpv(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    const result = computeNpvFromRegisters(
      this.cashFlows,
      this.cashFlowCounts,
      this.financial.i,
    );
    this.stack.x = Number.isFinite(result)
      ? roundToInternalPrecision(result)
      : Number.NaN;
    this.fShift = false;
    this.stackLiftEnabled = true;
  }

  private computeIrr(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    const result = computeIrr(
      this.cashFlows,
      this.cashFlowCounts,
      this.financial.i,
    );

    if (!Number.isFinite(result)) {
      this.stack.x = Number.NaN;
      this.fShift = false;
      this.stackLiftEnabled = true;
      return;
    }

    const rounded = roundToInternalPrecision(result);
    this.financial.i = rounded;
    this.stack.x = rounded;
    this.fShift = false;
    this.stackLiftEnabled = true;
  }

  private startEntryIfNeeded(): void {
    if (this.isEntering) {
      return;
    }

    if (this.stackLiftEnabled) {
      this.lift();
    }

    this.inputBuffer = "";
    this.isEntering = true;
    this.stackLiftEnabled = false;
  }

  private commitBufferToX(): void {
    if (this.isEnteringExponent) {
      this.stack.x = parseScientificEntry(
        this.inputBuffer,
        this.exponentBuffer,
        this.exponentNegative,
      );
      return;
    }

    this.stack.x = roundToInternalPrecision(parseInputBuffer(this.inputBuffer));
  }

  private endEntry(): void {
    this.clearCalendarResult();
    this.clearPrefixMantissa();
    this.inputBuffer = "";
    this.isEntering = false;
    this.isEnteringExponent = false;
    this.exponentBuffer = "";
    this.exponentNegative = false;
  }

  private clearCalendarResult(): void {
    this.calendarResultActive = false;
  }

  private clearPrefixMantissa(): void {
    this.prefixMantissaActive = false;
  }

  private setDateFormatDmy(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.dateFormat = "dmy";
    this.decimalPlaces = 6;
    this.clearCalendarResult();
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private setDateFormatMdy(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.dateFormat = "mdy";
    this.decimalPlaces = 6;
    this.clearCalendarResult();
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  /** g + CHS (DATE) — add days in X to the date in Y. */
  private addDaysToDate(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    const result = addDaysToDate(this.stack.y, this.stack.x, this.dateFormat);
    if (!result) {
      this.stack.x = Number.NaN;
      this.clearCalendarResult();
      this.gShift = false;
      this.stackLiftEnabled = true;
      return;
    }

    this.stack.x = result.encoded;
    this.stack.y = result.weekday;
    this.calendarResultActive = true;
    this.pendingStatAlternate = null;
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  /** g + EEX (ΔDYS) — actual days from Y to X; x↔y shows 30/360 days. */
  private deltaDaysBetween(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    const result = daysBetweenDates(
      this.stack.y,
      this.stack.x,
      this.dateFormat,
    );
    if (!result) {
      this.stack.x = Number.NaN;
      this.stack.y = 0;
      this.clearCalendarResult();
      this.gShift = false;
      this.stackLiftEnabled = true;
      return;
    }

    this.stack.x = roundToInternalPrecision(result.actual);
    this.stack.y = roundToInternalPrecision(result.days360);
    this.clearCalendarResult();
    this.pendingStatAlternate = "days360";
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private clearMemoryPrefix(): void {
    this.memoryPrefix = null;
  }

  private clearStatistics(): void {
    this.statistics = createEmptyStatistics();
    this.syncStatisticsToStorage();
    this.stack = { x: 0, y: 0, z: 0, t: 0 };
    this.pendingStatAlternate = null;
    this.endEntry();
    this.fShift = false;
    this.clearMemoryPrefix();
    this.stackLiftEnabled = false;
  }

  /** Keep faceplate registers R1–R6 aligned with statistics accumulators. */
  private syncStatisticsToStorage(): void {
    for (let register = 1; register <= 6; register += 1) {
      const value = statisticsRegisterValue(register, this.statistics);
      if (value !== null) {
        this.storage[register] = value;
      }
    }
  }

  private recallMeanOfX(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.stack.x = meanOfX(this.statistics);
    this.pendingStatAlternate = "meanY";
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private recallMeanOfY(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.stack.x = meanOfY(this.statistics);
    this.pendingStatAlternate = null;
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private recallSampleStdDevOfX(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    if (this.pendingStatAlternate === "stdDevY") {
      this.stack.x = sampleStdDevOfY(this.statistics);
      this.pendingStatAlternate = null;
    } else {
      this.stack.x = sampleStdDevOfX(this.statistics);
      this.pendingStatAlternate = "stdDevY";
    }

    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private recallWeightedMean(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.stack.x = weightedMean(this.statistics);
    this.pendingStatAlternate = null;
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private recallCorrelationCoefficient(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.stack.x = correlationCoefficient(this.statistics);
    this.pendingStatAlternate = null;
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  /** ŷ = A + Bx using accumulated (x, y) pairs; stores r in Y for x↔y recall. */
  private forecastYFromX(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.stack.x = forecastY(this.statistics, this.stack.x);
    this.stack.y = correlationCoefficient(this.statistics);
    this.pendingStatAlternate = "correlation";
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  /** x̂ from y in X using the regression line; stores r in Y for x↔y recall. */
  private forecastXFromY(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.stack.x = forecastX(this.statistics, this.stack.x);
    this.stack.y = correlationCoefficient(this.statistics);
    this.pendingStatAlternate = "correlation";
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  private storeToRegister(register: number): void {
    this.endEntry();
    const value = roundToInternalPrecision(this.stack.x);
    this.storage[register] = value;
    if (register >= 1 && register <= 6) {
      this.statistics = applyStatisticsRegisterValue(
        register,
        value,
        this.statistics,
      );
    }
    this.clearMemoryPrefix();
    this.stackLiftEnabled = true;
  }

  private recallFromRegister(register: number): void {
    this.endEntry();
    const statisticsValue = statisticsRegisterValue(register, this.statistics);
    this.stack.x =
      statisticsValue !== null && register >= 1 && register <= 6
        ? statisticsValue
        : roundToInternalPrecision(this.storage[register]);
    this.clearMemoryPrefix();
    this.stackLiftEnabled = true;
  }

  private setPaymentMode(mode: PaymentMode): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.paymentMode = mode;
    this.gShift = false;
  }

  private handleTvmKey(key: TvmRegister): void {
    this.clearMemoryPrefix();

    if (this.isEntering) {
      this.financial[key] = roundToInternalPrecision(this.stack.x);
      this.endEntry();
      this.stackLiftEnabled = false;
      return;
    }

    const result = solveTvm(key, this.financial, this.paymentMode);
    if (!Number.isFinite(result)) {
      this.stack.x = Number.NaN;
      this.endEntry();
      return;
    }

    const rounded = roundToInternalPrecision(result);
    this.financial[key] = rounded;
    this.stack.x = rounded;
    this.endEntry();
    this.stackLiftEnabled = true;
  }

  private binaryOp(operation: (y: number, x: number) => number): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.lastX = this.stack.x;
    const result = roundToInternalPrecision(operation(this.stack.y, this.stack.x));
    this.drop(result);
    this.clearShifts();
    this.stackLiftEnabled = true;
  }

  private unaryOp(operation: (x: number) => number): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.lastX = this.stack.x;
    const result = roundToInternalPrecision(operation(this.stack.x));
    this.stack.x = result;
    this.clearShifts();
    this.stackLiftEnabled = true;
  }

  /**
   * Two-number op that updates X from Y and X while preserving Y (% keys).
   */
  private yPreservingOp(operation: (y: number, x: number) => number): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.lastX = this.stack.x;
    this.stack.x = roundToInternalPrecision(operation(this.stack.y, this.stack.x));
    this.clearShifts();
    this.stackLiftEnabled = true;
  }

  private clearShifts(): void {
    this.fShift = false;
    this.gShift = false;
  }

  /** g + 9 (MEM) — program memory steps remaining (0 until programming exists). */
  private showProgramMemoryRemaining(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.stack.x = 0;
    this.gShift = false;
    this.stackLiftEnabled = true;
  }

  /** g + 3 (n!) — factorial of X for non-negative integers. */
  private factorialX(): void {
    this.unaryOp((x) => factorial(x));
  }

  /** 1/x — reciprocal of X (f + key = YTM). */
  pressReciprocalKey(): void {
    if (this.gShift) {
      this.ePowX();
      return;
    }

    if (this.fShift) {
      this.computeBondYieldFromPrice();
      return;
    }

    this.reciprocal();
  }

  /** y^x — Y raised to the X power (f + key = PRICE). */
  pressYPowXKey(): void {
    if (this.gShift) {
      this.sqrtX();
      return;
    }

    if (this.fShift) {
      this.computeBondPriceFromYield();
      return;
    }

    this.yPowX();
  }

  private bondInputsFromStack() {
    return {
      settlementEncoded: this.stack.y,
      maturityEncoded: this.stack.x,
      dateFormat: this.dateFormat,
      couponPercent: this.financial.pmt,
      yieldPercent: this.financial.i,
      cleanPrice: this.financial.pv,
    };
  }

  /** f + y^x (PRICE) — bond price from yield, coupon, and dates in Y/X. */
  private computeBondPriceFromYield(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    const result = bondPriceFromYield(this.bondInputsFromStack());
    if (!result) {
      this.stack.x = Number.NaN;
      this.stack.y = 0;
      this.fShift = false;
      this.stackLiftEnabled = true;
      return;
    }

    this.financial.pv = result.cleanPrice;
    this.stack.x = result.cleanPrice;
    this.stack.y = result.accruedInterest;
    this.fShift = false;
    this.stackLiftEnabled = true;
  }

  /** f + 1/x (YTM) — yield to maturity from price, coupon, and dates in Y/X. */
  private computeBondYieldFromPrice(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    const result = bondYieldFromPrice(this.bondInputsFromStack());
    if (!result) {
      this.stack.x = Number.NaN;
      this.stack.y = 0;
      this.fShift = false;
      this.stackLiftEnabled = true;
      return;
    }

    this.financial.i = result.yieldPercent;
    this.stack.x = result.yieldPercent;
    this.stack.y = result.accruedInterest;
    this.fShift = false;
    this.stackLiftEnabled = true;
  }

  reciprocal(): void {
    this.unaryOp((x) => (x === 0 ? Number.NaN : 1 / x));
  }

  ePowX(): void {
    this.unaryOp((x) => Math.exp(x));
  }

  sqrtX(): void {
    this.unaryOp((x) => (x < 0 ? Number.NaN : Math.sqrt(x)));
  }

  yPowX(): void {
    this.binaryOp((y, x) => Math.pow(y, x));
  }

  /** %T — what percent X is of Y (f + key = SL depreciation). */
  pressPercentOfTotalKey(): void {
    if (this.fShift) {
      this.computeStraightLineDepreciation();
      return;
    }

    if (this.gShift) {
      this.ln();
      return;
    }

    this.percentOfTotal();
  }

  /** Δ% — percent change from Y to X (f + key = SOYD depreciation). */
  pressDeltaPercentKey(): void {
    if (this.fShift) {
      this.computeSumOfYearsDigitsDepreciation();
      return;
    }

    if (this.gShift) {
      this.frac();
      return;
    }

    this.deltaPercent();
  }

  /** % — X percent of Y (f + key = DB depreciation). */
  pressPercentKey(): void {
    if (this.fShift) {
      this.computeDecliningBalanceDepreciation();
      return;
    }

    if (this.gShift) {
      this.intg();
      return;
    }

    this.percent();
  }

  private depreciationInputs() {
    return {
      cost: this.financial.pv,
      salvage: this.financial.fv,
      life: this.financial.n,
      year: Math.trunc(this.stack.x),
      dbFactor: this.financial.i,
    };
  }

  private applyDepreciationResult(
    result: ReturnType<typeof straightLineDepreciation>,
  ): void {
    if (!result) {
      this.stack.x = Number.NaN;
      this.stack.y = 0;
      this.fShift = false;
      this.stackLiftEnabled = true;
      return;
    }

    this.stack.x = result.depreciation;
    this.stack.y = result.remainingDepreciable;
    this.fShift = false;
    this.stackLiftEnabled = true;
  }

  /** f + %T (SL) — straight-line depreciation for the year in X. */
  private computeStraightLineDepreciation(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.applyDepreciationResult(
      straightLineDepreciation(this.depreciationInputs()),
    );
  }

  /** f + Δ% (SOYD) — sum-of-the-years-digits depreciation for the year in X. */
  private computeSumOfYearsDigitsDepreciation(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.applyDepreciationResult(
      sumOfYearsDigitsDepreciation(this.depreciationInputs()),
    );
  }

  /** f + % (DB) — declining-balance depreciation for the year in X. */
  private computeDecliningBalanceDepreciation(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.applyDepreciationResult(
      decliningBalanceDepreciation(this.depreciationInputs()),
    );
  }

  percent(): void {
    this.yPreservingOp((y, x) => (y * x) / 100);
  }

  deltaPercent(): void {
    this.yPreservingOp((y, x) => (y === 0 ? Number.NaN : ((x - y) / y) * 100));
  }

  percentOfTotal(): void {
    this.yPreservingOp((y, x) => (y === 0 ? Number.NaN : (100 * x) / y));
  }

  ln(): void {
    this.unaryOp((x) => (x <= 0 ? Number.NaN : Math.log(x)));
  }

  frac(): void {
    this.unaryOp((x) => {
      const truncated = Math.trunc(x);
      return x - truncated;
    });
  }

  intg(): void {
    this.unaryOp((x) => Math.trunc(x));
  }

  /** f + n — amortize the number of payments in X against PV/PMT/i. */
  amortize(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    const periodsToAmortize = Math.max(0, Math.trunc(this.stack.x));
    const result = amortizePayments(
      this.financial.pv,
      this.financial.pmt,
      this.financial.i,
      periodsToAmortize,
      this.financial.n,
      this.paymentMode,
      this.decimalPlaces,
    );

    this.financial.pv = result.remainingPv;
    this.financial.n = result.totalAmortizedPeriods;
    this.stack.x = result.totalInterest;
    this.stack.y = result.totalPrincipal;
    this.fShift = false;
    this.stackLiftEnabled = true;
  }

  /** f + i — simple interest; X = 360-day interest, Y = |PV|, Z = 365-day interest. */
  simpleInterest(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    const { pv, i, n } = this.financial;
    this.stack.x = simpleInterest360(pv, i, n);
    this.stack.y = roundToInternalPrecision(Math.abs(pv));
    this.stack.z = simpleInterest365(pv, i, n);
    this.fShift = false;
    this.stackLiftEnabled = true;
  }

  /** f + PMT — round X to the current display decimal places. */
  rnd(): void {
    this.endEntry();
    this.clearMemoryPrefix();
    this.stack.x = roundToDisplayDecimalPlaces(this.stack.x, this.decimalPlaces);
    this.fShift = false;
    this.stackLiftEnabled = true;
  }

  /** Σ+ — add X (and Y) to the statistics accumulators; display n. */
  sigmaPlus(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    const { x, y } = this.stack;
    this.statistics = accumulatePair(this.statistics, x, y);
    this.syncStatisticsToStorage();
    this.stack.x = roundToInternalPrecision(this.statistics.n);
    this.fShift = false;
    this.gShift = false;
    this.pendingStatAlternate = null;
    this.stackLiftEnabled = false;
  }

  /** g + Σ+ — subtract X (and Y) from the statistics accumulators; display n. */
  sigmaMinus(): void {
    this.endEntry();
    this.clearMemoryPrefix();

    const { x, y } = this.stack;
    this.statistics = removePair(this.statistics, x, y);
    this.syncStatisticsToStorage();
    this.stack.x = roundToInternalPrecision(this.statistics.n);
    this.fShift = false;
    this.gShift = false;
    this.pendingStatAlternate = null;
    this.stackLiftEnabled = false;
  }

  /** Σ+ / g Σ− — accumulate or remove an (x, y) pair; display n. */
  pressSigmaKey(): void {
    if (this.gShift) {
      this.sigmaMinus();
      return;
    }

    this.sigmaPlus();
  }

  /** f + SST — clear statistics; g + SST — backspace last digit. */
  pressSst(): void {
    if (this.gShift) {
      this.backspace();
      return;
    }

    if (this.fShift) {
      this.clearStatistics();
      return;
    }
  }

  /** g + × — linear estimate ŷ for x in X. */
  pressMultiplyKey(): void {
    if (this.gShift) {
      this.forecastYFromX();
      return;
    }

    this.multiply();
  }

  /** g + − — linear estimate x̂ for y in X. */
  pressSubtractKey(): void {
    if (this.gShift) {
      this.forecastXFromY();
      return;
    }

    this.subtract();
  }

  /** Y + X */
  add(): void {
    this.binaryOp((y, x) => y + x);
  }

  /** Y − X */
  subtract(): void {
    this.binaryOp((y, x) => y - x);
  }

  /** Y × X */
  multiply(): void {
    this.binaryOp((y, x) => y * x);
  }

  /** Y ÷ X */
  divide(): void {
    this.binaryOp((y, x) => y / x);
  }
}

export function createRpnEngine(): RpnEngine {
  return new RpnEngine();
}
