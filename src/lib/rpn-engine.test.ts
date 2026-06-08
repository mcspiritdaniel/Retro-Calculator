import { describe, expect, it } from "vitest";
import { formatLcdDisplay } from "./lcd-format";
import { createRpnEngine, type RpnEngine } from "./rpn-engine";

/** Logs full stack state — useful when debugging RPN key sequences. */
function logStackState(engine: RpnEngine, label: string): void {
  const s = engine.getStack();
  console.log(
    `${label}: X=${s.x} Y=${s.y} Z=${s.z} T=${s.t} lift=${engine.stackLiftEnabled} entering=${engine.getIsEntering()}`,
  );
}

/** Keys a decimal number through the faceplate digit entry path. */
function keyNumber(engine: RpnEngine, value: string): void {
  const [whole, fraction] = value.split(".");
  whole.split("").forEach((digit) => engine.pressDigit(digit));
  if (fraction) {
    engine.pressDecimal();
    fraction.split("").forEach((digit) => engine.pressDigit(digit));
  }
}

describe("RpnEngine — stack behavior", () => {
  it("starts with an empty stack and zeroed financial registers", () => {
    const engine = createRpnEngine();

    expect(engine.getStack()).toEqual({ x: 0, y: 0, z: 0, t: 0 });
    expect(engine.lastX).toBe(0);
    expect(engine.fShift).toBe(false);
    expect(engine.gShift).toBe(false);
    expect(engine.decimalPlaces).toBe(2);
    expect(engine.cashFlows).toEqual([]);
    expect(engine.getStorage()).toEqual(Array(10).fill(0));
    expect(engine.getMemoryPrefix()).toBeNull();
    expect(engine.paymentMode).toBe("end");
    expect(engine.financial).toEqual({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0 });
    expect(engine.stackLiftEnabled).toBe(false);
  });

  it("lifts the stack on ENTER, copying X into Y", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 5, y: 1, z: 2, t: 3 });

    engine.enter();

    expect(engine.getStack()).toEqual({ x: 5, y: 5, z: 1, t: 2 });
    expect(engine.stackLiftEnabled).toBe(false);
  });

  it("duplicates T on stack drop after addition", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 3, y: 7, z: 11, t: 13 });

    engine.add();

    expect(engine.getStack()).toEqual({ x: 10, y: 11, z: 13, t: 13 });
    expect(engine.lastX).toBe(3);
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("duplicates T on stack drop after subtraction (Y − X)", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 3, y: 10, z: 20, t: 30 });

    engine.subtract();

    expect(engine.getStack()).toEqual({ x: 7, y: 20, z: 30, t: 30 });
    expect(engine.lastX).toBe(3);
  });

  it("duplicates T on stack drop after multiplication and division", () => {
    const multiply = createRpnEngine();
    multiply.setStack({ x: 4, y: 5, z: 9, t: 9 });
    multiply.multiply();
    expect(multiply.getStack()).toEqual({ x: 20, y: 9, z: 9, t: 9 });
    expect(multiply.lastX).toBe(4);

    const divide = createRpnEngine();
    divide.setStack({ x: 4, y: 20, z: 6, t: 6 });
    divide.divide();
    expect(divide.getStack()).toEqual({ x: 5, y: 6, z: 6, t: 6 });
    expect(divide.lastX).toBe(4);
  });

  it("runs the classic RPN arithmetic sequence: 1 ENTER 2 ENTER 3 +", () => {
    const engine = createRpnEngine();

    engine.setX(1);
    engine.enter();
    expect(engine.getStack()).toEqual({ x: 1, y: 1, z: 0, t: 0 });

    engine.setX(2);
    engine.enter();
    expect(engine.getStack()).toEqual({ x: 2, y: 2, z: 1, t: 0 });

    engine.setX(3);
    engine.add();
    expect(engine.getStack()).toEqual({ x: 5, y: 1, z: 0, t: 0 });
    expect(engine.lastX).toBe(3);
  });

  it("builds a four-deep stack across successive ENTER presses", () => {
    const engine = createRpnEngine();

    engine.setX(1);
    engine.enter();
    engine.setX(2);
    engine.enter();
    engine.setX(3);
    engine.enter();
    engine.setX(4);
    engine.enter();

    expect(engine.getStack()).toEqual({ x: 4, y: 4, z: 3, t: 2 });
  });

  it("auto-lifts on beginNumberEntry when stackLiftEnabled", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 5, y: 1, z: 2, t: 3 });
    engine.stackLiftEnabled = true;

    engine.beginNumberEntry(9);

    expect(engine.getStack()).toEqual({ x: 9, y: 5, z: 1, t: 2 });
    expect(engine.stackLiftEnabled).toBe(false);
  });

  it("does not auto-lift on beginNumberEntry immediately after ENTER", () => {
    const engine = createRpnEngine();
    engine.setX(5);
    engine.enter();

    engine.beginNumberEntry(9);

    expect(engine.getStack()).toEqual({ x: 9, y: 5, z: 0, t: 0 });
  });

  it("exposes shift and financial register placeholders on snapshot", () => {
    const engine = createRpnEngine();
    engine.fShift = true;
    engine.financial = { n: 12, i: 6, pv: 1000, pmt: -100, fv: 0 };

    const snapshot = engine.getSnapshot();

    expect(snapshot.fShift).toBe(true);
    expect(snapshot.gShift).toBe(false);
    expect(snapshot.financial).toEqual({
      n: 12,
      i: 6,
      pv: 1000,
      pmt: -100,
      fv: 0,
    });
  });
});

describe("RpnEngine — digit entry and input buffer", () => {
  it("types 1 . 5 CHS into X = -1.5", () => {
    const engine = createRpnEngine();

    engine.pressDigit("1");
    engine.pressDecimal();
    engine.pressDigit("5");
    engine.chs();

    expect(engine.display).toBe(-1.5);
    expect(engine.getInputBuffer()).toBe("-1.5");
    expect(engine.getIsEntering()).toBe(true);
  });

  it("limits entry to ten digit characters", () => {
    const engine = createRpnEngine();

    "1234567890".split("").forEach((digit) => engine.pressDigit(digit));
    engine.pressDigit("1");

    expect(engine.getInputBuffer()).toBe("1234567890");
    expect(engine.display).toBe(1234567890);
  });

  it("accepts small numbers keyed as 0.00000012", () => {
    const engine = createRpnEngine();

    engine.pressDigit("0");
    engine.pressDecimal();
    "00000012".split("").forEach((digit) => engine.pressDigit(digit));

    expect(engine.getInputBuffer()).toBe("0.00000012");
    expect(engine.display).toBeCloseTo(0.00000012, 12);
  });

  it("accepts small numbers keyed with a leading decimal point", () => {
    const engine = createRpnEngine();

    engine.pressDecimal();
    "00000012".split("").forEach((digit) => engine.pressDigit(digit));

    expect(engine.getInputBuffer()).toBe("0.00000012");
    expect(engine.display).toBeCloseTo(0.00000012, 12);
  });

  it("rejects a second decimal point in the same number", () => {
    const engine = createRpnEngine();

    engine.pressDigit("1");
    engine.pressDecimal();
    engine.pressDigit("2");
    engine.pressDecimal();
    engine.pressDigit("3");

    expect(engine.display).toBe(1.23);
    expect(engine.getInputBuffer()).toBe("1.23");
    expect((engine.getInputBuffer().match(/\./g) ?? []).length).toBe(1);
  });

  it("backspace removes the last typed digit", () => {
    const engine = createRpnEngine();

    engine.pressDigit("1");
    engine.pressDigit("2");
    engine.pressDigit("3");
    engine.backspace();

    expect(engine.display).toBe(12);
    expect(engine.getInputBuffer()).toBe("12");
  });

  it("CLX clears X without disturbing Y, Z, or T", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 99, y: 4, z: 5, t: 6 });

    engine.pressDigit("9");
    engine.clx();

    expect(engine.getStack()).toEqual({ x: 0, y: 4, z: 5, t: 6 });
    expect(engine.getIsEntering()).toBe(false);
  });

  it("CHS inverts committed X when not entering a number", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 7, y: 1, z: 2, t: 3 });

    engine.chs();

    expect(engine.display).toBe(-7);
    expect(engine.getStack()).toEqual({ x: -7, y: 1, z: 2, t: 3 });
    expect(engine.getIsEntering()).toBe(false);
  });

  it("auto-lifts the stack on the first digit when stackLiftEnabled", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 5, y: 1, z: 2, t: 3 });
    engine.stackLiftEnabled = true;

    engine.pressDigit("9");

    expect(engine.getStack()).toEqual({ x: 9, y: 5, z: 1, t: 2 });
    expect(engine.stackLiftEnabled).toBe(false);
  });

  it("does not auto-lift on the first digit immediately after ENTER", () => {
    const engine = createRpnEngine();

    engine.pressDigit("5");
    engine.enter();
    engine.pressDigit("9");

    expect(engine.getStack()).toEqual({ x: 9, y: 5, z: 0, t: 0 });
  });
});

describe("RpnEngine — roll down (R↓)", () => {
  it("rolls Y→X, Z→Y, T→Z, X→T per the reference layout", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 1, y: 2, z: 3, t: 4 });

    engine.rollDown();

    expect(engine.getStack()).toEqual({ x: 2, y: 3, z: 4, t: 1 });
    expect(engine.stackLiftEnabled).toBe(false);
    logStackState(engine, "after R↓");
  });

  it("commits in-progress entry before rolling", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 9, y: 1, z: 2, t: 3 });

    engine.pressDigit("5");
    engine.pressDecimal();
    engine.pressDigit("5");
    engine.rollDown();

    expect(engine.display).toBe(1);
    expect(engine.getStack()).toEqual({ x: 1, y: 2, z: 3, t: 5.5 });
    expect(engine.getIsEntering()).toBe(false);
  });

  it("does not auto-lift on the next digit after R↓", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 1, y: 2, z: 3, t: 4 });
    engine.stackLiftEnabled = true;

    engine.rollDown();
    engine.pressDigit("9");

    expect(engine.getStack()).toEqual({ x: 9, y: 3, z: 4, t: 1 });
    logStackState(engine, "R↓ then 9");
  });

  it("can unwind a stack built with successive ENTER presses", () => {
    const engine = createRpnEngine();

    engine.setX(1);
    engine.enter();
    engine.setX(2);
    engine.enter();
    engine.setX(3);
    engine.enter();
    engine.setX(4);
    engine.enter();
    expect(engine.getStack()).toEqual({ x: 4, y: 4, z: 3, t: 2 });

    engine.rollDown();
    expect(engine.getStack()).toEqual({ x: 4, y: 3, z: 2, t: 4 });

    engine.rollDown();
    expect(engine.getStack()).toEqual({ x: 3, y: 2, z: 4, t: 4 });
  });
});

describe("RpnEngine — x↔y and LSTx", () => {
  it("exchanges X and Y without disturbing Z or T", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 5, y: 9, z: 3, t: 7 });

    engine.swapXy();

    expect(engine.getStack()).toEqual({ x: 9, y: 5, z: 3, t: 7 });
    expect(engine.stackLiftEnabled).toBe(false);
    logStackState(engine, "after x↔y");
  });

  it("commits in-progress entry before swapping", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 1, y: 8, z: 0, t: 0 });

    engine.pressDigit("2");
    engine.swapXy();

    expect(engine.display).toBe(8);
    expect(engine.getStack()).toEqual({ x: 8, y: 2, z: 0, t: 0 });
    expect(engine.getIsEntering()).toBe(false);
  });

  it("does not auto-lift on the next digit after x↔y", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 1, y: 2, z: 3, t: 4 });
    engine.stackLiftEnabled = true;

    engine.swapXy();
    engine.pressDigit("9");

    expect(engine.getStack()).toEqual({ x: 9, y: 1, z: 3, t: 4 });
  });

  it("LSTx lifts the stack and recalls lastX into X", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 10, y: 20, z: 30, t: 40 });
    engine.lastX = 6;

    engine.lstX();

    expect(engine.getStack()).toEqual({ x: 6, y: 10, z: 20, t: 30 });
    expect(engine.stackLiftEnabled).toBe(false);
    logStackState(engine, "after LSTx");
  });

  it("routes g + ENTER to LSTx and clears g shift", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 4, y: 5, z: 0, t: 0 });
    engine.lastX = 2;
    engine.gShift = true;

    engine.pressEnter();

    expect(engine.getStack()).toEqual({ x: 2, y: 4, z: 5, t: 0 });
    expect(engine.gShift).toBe(false);
  });

  it("recalls lastX after a binary operation", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 3, y: 7, z: 0, t: 0 });

    engine.add();
    expect(engine.lastX).toBe(3);
    expect(engine.display).toBe(10);

    engine.lstX();

    expect(engine.display).toBe(3);
    expect(engine.getStack()).toEqual({ x: 3, y: 10, z: 0, t: 0 });
  });
});

describe("RpnEngine — STO and RCL (registers 0–9)", () => {
  it("stores X into a register with STO then digit", () => {
    const engine = createRpnEngine();
    engine.setX(42);

    engine.pressSto();
    expect(engine.getMemoryPrefix()).toBe("sto");
    engine.pressDigit("3");

    expect(engine.getStorage()[3]).toBe(42);
    expect(engine.getMemoryPrefix()).toBeNull();
    expect(engine.stackLiftEnabled).toBe(true);
    logStackState(engine, "after STO 3");
  });

  it("recalls Σx with RCL 2 after one-variable Σ+ accumulation", () => {
    const engine = createRpnEngine();
    engine.fShift = true;
    engine.pressSst();

    for (const value of [2, 4, 6]) {
      engine.setX(value);
      engine.sigmaPlus();
    }

    engine.pressRcl();
    engine.pressDigit("2");

    expect(engine.display).toBe(12);
    expect(engine.getStorage()[2]).toBe(12);
  });

  it("recalls n with RCL 1 after Σ+ accumulation", () => {
    const engine = createRpnEngine();

    for (const value of [2, 4, 6]) {
      engine.setX(value);
      engine.sigmaPlus();
    }

    engine.pressRcl();
    engine.pressDigit("1");

    expect(engine.display).toBe(3);
  });

  it("recalls a register into X with RCL then digit", () => {
    const engine = createRpnEngine();
    engine.setX(99);
    engine.pressSto();
    engine.pressDigit("5");
    engine.setX(0);

    engine.pressRcl();
    engine.pressDigit("5");

    expect(engine.display).toBe(99);
    expect(engine.getMemoryPrefix()).toBeNull();
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("stores the committed value when STO follows digit entry", () => {
    const engine = createRpnEngine();

    engine.pressDigit("1");
    engine.pressDecimal();
    engine.pressDigit("5");
    engine.pressSto();
    engine.pressDigit("0");

    expect(engine.getStorage()[0]).toBe(1.5);
    expect(engine.getIsEntering()).toBe(false);
  });

  it("keeps independent values across multiple registers", () => {
    const engine = createRpnEngine();

    engine.setX(10);
    engine.pressSto();
    engine.pressDigit("1");

    engine.setX(20);
    engine.pressSto();
    engine.pressDigit("2");

    expect(engine.getStorage()[1]).toBe(10);
    expect(engine.getStorage()[2]).toBe(20);
  });

  it("auto-lifts on the next digit after RCL", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 7, y: 2, z: 3, t: 4 });
    engine.setX(99);
    engine.pressSto();
    engine.pressDigit("4");

    engine.pressRcl();
    engine.pressDigit("4");
    engine.pressDigit("8");

    expect(engine.getStack()).toEqual({ x: 8, y: 99, z: 2, t: 3 });
  });

  it("does not treat f + digit as decimal places while STO is armed", () => {
    const engine = createRpnEngine();
    engine.setX(5);
    engine.fShift = true;
    engine.pressSto();
    engine.pressDigit("2");

    expect(engine.getStorage()[2]).toBe(5);
    expect(engine.decimalPlaces).toBe(2);
    expect(engine.fShift).toBe(true);
  });

  it("clears an armed STO prefix when ENTER is pressed", () => {
    const engine = createRpnEngine();
    engine.setX(5);
    engine.pressSto();

    engine.enter();

    expect(engine.getMemoryPrefix()).toBeNull();
    engine.pressDigit("3");
    expect(engine.getStorage()[3]).toBe(0);
    expect(engine.display).toBe(3);
  });

  it("subtracts from a storage register with STO − n without changing X", () => {
    const engine = createRpnEngine();
    engine.setX(58.33);
    engine.pressSto();
    engine.pressDigit("0");

    engine.setX(22.95);
    engine.pressSto();
    engine.pressSubtractKey();
    engine.pressDigit("0");

    expect(engine.getStorage()[0]).toBeCloseTo(35.38, 2);
    expect(engine.display).toBeCloseTo(22.95, 2);
    expect(engine.getMemoryPrefix()).toBeNull();
  });

  it("adds to a storage register with STO + n without changing X", () => {
    const engine = createRpnEngine();
    engine.setX(100);
    engine.pressSto();
    engine.pressDigit("0");

    engine.setX(25);
    engine.pressSto();
    engine.add();
    engine.pressDigit("0");

    expect(engine.getStorage()[0]).toBeCloseTo(125, 2);
    expect(engine.display).toBeCloseTo(25, 2);
  });

  it("runs the HP manual checking-account storage arithmetic example", () => {
    const engine = createRpnEngine();

    engine.pressDigit("5");
    engine.pressDigit("8");
    engine.pressDecimal();
    engine.pressDigit("3");
    engine.pressDigit("3");
    engine.pressSto();
    engine.pressDigit("0");
    expect(engine.getStorage()[0]).toBeCloseTo(58.33, 2);

    for (const check of ["22.95", "13.70", "10.14"]) {
      const [whole, frac = ""] = check.split(".");
      for (const digit of whole) {
        engine.pressDigit(digit);
      }
      engine.pressDecimal();
      for (const digit of frac) {
        engine.pressDigit(digit);
      }
      engine.pressSto();
      engine.pressSubtractKey();
      engine.pressDigit("0");
    }

    engine.pressDigit("1");
    engine.pressDigit("0");
    engine.pressDigit("5");
    engine.pressDigit("3");
    engine.pressSto();
    engine.add();
    engine.pressDigit("0");

    engine.pressRcl();
    engine.pressDigit("0");

    expect(engine.getStorage()[0]).toBeCloseTo(1064.54, 2);
    expect(engine.display).toBeCloseTo(1064.54, 2);
  });

  it("clears storage on reset", () => {
    const engine = createRpnEngine();
    engine.setX(12);
    engine.pressSto();
    engine.pressDigit("6");

    engine.reset();

    expect(engine.getStorage()).toEqual(Array(10).fill(0));
  });

  it("clears storage, stack, financial registers, and display with f then CLx (REG)", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 99, y: 4, z: 5, t: 6 });
    engine.setX(42);
    engine.pressSto();
    engine.pressDigit("2");
    engine.financial = { n: 30, i: 5, pv: -1000, pmt: 100, fv: 0 };
    engine.cashFlows = [-500];
    engine.lastX = 7;
    engine.fShift = true;

    engine.clx();

    expect(engine.getStorage()).toEqual(Array(10).fill(0));
    expect(engine.getStack()).toEqual({ x: 0, y: 0, z: 0, t: 0 });
    expect(engine.financial).toEqual({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0 });
    expect(engine.cashFlows).toEqual([]);
    expect(engine.lastX).toBe(0);
    expect(engine.display).toBe(0);
    expect(engine.fShift).toBe(false);
    expect(engine.getIsEntering()).toBe(false);
  });
});

describe("RpnEngine — BEG and END payment mode", () => {
  it("sets BEG mode with g then 7", () => {
    const engine = createRpnEngine();
    engine.gShift = true;

    engine.pressDigit("7");

    expect(engine.paymentMode).toBe("beg");
    expect(engine.gShift).toBe(false);
  });

  it("returns to END mode with g then 8", () => {
    const engine = createRpnEngine();
    engine.paymentMode = "beg";
    engine.gShift = true;

    engine.pressDigit("8");

    expect(engine.paymentMode).toBe("end");
    expect(engine.gShift).toBe(false);
  });

  it("computes a larger FV in BEG mode for the tutorial example", () => {
    const endEngine = createRpnEngine();
    endEngine.financial = { n: 36, i: 1, pv: 0, pmt: 100, fv: 0 };
    endEngine.pressTvmFv();
    expect(endEngine.display).toBeCloseTo(-4307.69, 1);

    const begEngine = createRpnEngine();
    begEngine.paymentMode = "beg";
    begEngine.financial = { n: 36, i: 1, pv: 0, pmt: 100, fv: 0 };
    begEngine.pressTvmFv();
    expect(begEngine.display).toBeCloseTo(-4350.76, 1);
    expect(begEngine.display).toBeLessThan(endEngine.display);
  });
});

describe("RpnEngine — TVM solvers", () => {
  it("stores a typed value into a TVM register when entering a number", () => {
    const engine = createRpnEngine();

    engine.pressDigit("3");
    engine.pressDigit("0");
    engine.pressTvmN();

    expect(engine.financial.n).toBe(30);
    expect(engine.getIsEntering()).toBe(false);
    expect(engine.display).toBe(30);
  });

  it("calculates PMT for a classic loan: n=30, i=5, PV=-10000, FV=0", () => {
    const engine = createRpnEngine();
    engine.financial = { n: 30, i: 5, pv: -10000, pmt: 0, fv: 0 };

    engine.pressTvmPmt();

    expect(engine.financial.pmt).toBeCloseTo(650.514351, 4);
    expect(engine.display).toBeCloseTo(650.514351, 4);
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("stores a computed value into PV after arithmetic instead of re-solving", () => {
    const engine = createRpnEngine();
    engine.financial = { n: 360, i: 11.5 / 12, pv: 60000, pmt: -594.17, fv: 0 };

    engine.pressRcl();
    engine.pressTvmPv();
    expect(engine.display).toBe(60000);

    engine.pressDigit("2");
    engine.pressPercentKey();
    engine.subtract();
    engine.pressDigit("1");
    engine.pressDigit("5");
    engine.pressDigit("0");
    engine.subtract();
    engine.pressTvmPv();

    expect(engine.display).toBe(58650);
    expect(engine.financial.pv).toBe(58650);
  });

  it("matches the mortgage APR example with points and closing costs", () => {
    const pressNumber = (engine: ReturnType<typeof createRpnEngine>, value: string) => {
      for (const character of value) {
        if (character === ".") {
          engine.pressDecimal();
        } else {
          engine.pressDigit(character);
        }
      }
    };

    const engine = createRpnEngine();
    engine.gShift = true;
    engine.pressDigit("8");
    engine.fShift = true;
    engine.swapXy();

    pressNumber(engine, "30");
    engine.gShift = true;
    engine.pressTvmN();
    pressNumber(engine, "11.5");
    engine.gShift = true;
    engine.pressTvmI();
    pressNumber(engine, "60000");
    engine.pressTvmPv();
    engine.pressTvmPmt();
    expect(engine.display).toBeCloseTo(-594.17, 2);

    engine.pressRcl();
    engine.pressTvmPv();
    engine.pressDigit("2");
    engine.pressPercentKey();
    engine.subtract();
    pressNumber(engine, "150");
    engine.subtract();
    engine.pressTvmPv();
    expect(engine.financial.pv).toBe(58650);

    engine.pressTvmI();
    expect(engine.display).toBeCloseTo(0.98, 2);

    pressNumber(engine, "12");
    engine.multiply();
    expect(engine.display).toBeCloseTo(11.8, 2);
  });

  it("clears all TVM registers when f then x↔y is pressed", () => {
    const engine = createRpnEngine();
    engine.financial = { n: 30, i: 5, pv: -10000, pmt: 650.51, fv: 0 };
    engine.fShift = true;

    engine.swapXy();

    expect(engine.financial).toEqual({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0 });
    expect(engine.fShift).toBe(false);
  });

  it("solves interest rate from the other TVM registers", () => {
    const engine = createRpnEngine();
    engine.financial = {
      n: 30,
      i: 0,
      pv: -10000,
      pmt: 650.514351,
      fv: 0,
    };

    engine.pressTvmI();

    expect(engine.financial.i).toBeCloseTo(5, 3);
    expect(engine.display).toBeCloseTo(5, 3);
  });
});

describe("RpnEngine — display precision (f + digit)", () => {
  it("sets decimalPlaces when f is active and a digit is pressed", () => {
    const engine = createRpnEngine();
    engine.fShift = true;

    engine.pressDigit("4");

    expect(engine.decimalPlaces).toBe(4);
    expect(engine.fShift).toBe(false);
    expect(engine.getIsEntering()).toBe(false);
  });

  it("does not append the digit to X when setting decimal places", () => {
    const engine = createRpnEngine();
    engine.setX(123.456);
    engine.fShift = true;

    engine.pressDigit("0");

    expect(engine.decimalPlaces).toBe(0);
    expect(engine.display).toBe(123.456);
  });

  it("accepts nine decimal places when f is active and 9 is pressed", () => {
    const engine = createRpnEngine();
    engine.fShift = true;

    engine.pressDigit("9");

    expect(engine.decimalPlaces).toBe(9);
    expect(engine.fShift).toBe(false);
  });

  it("ends active entry and reformats the display when f and a digit set decimal places", () => {
    const engine = createRpnEngine();
    engine.pressDigit("3");
    engine.pressDecimal();
    engine.pressDigit("8");
    engine.pressDigit("7");
    engine.pressDigit("6");
    engine.pressDigit("5");
    engine.pressDigit("4");
    engine.pressDigit("3");
    engine.pressDigit("2");
    engine.pressDigit("1");
    engine.fShift = true;

    engine.pressDigit("2");

    expect(engine.decimalPlaces).toBe(2);
    expect(engine.getIsEntering()).toBe(false);
    expect(engine.display).toBeCloseTo(3.87654321, 8);
    expect(
      formatLcdDisplay({
        value: engine.display,
        isEntering: false,
        inputBuffer: "",
        decimalPlaces: engine.decimalPlaces,
      }),
    ).toBe("3.88");
  });
});

describe("RpnEngine — TVM shift routing (12× and 12÷)", () => {
  it("stores X × 12 into n when g then n is pressed", () => {
    const engine = createRpnEngine();
    engine.setX(2.5);
    engine.gShift = true;

    engine.pressTvmN();

    expect(engine.financial.n).toBe(30);
    expect(engine.display).toBe(30);
    expect(engine.gShift).toBe(false);
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("stores X ÷ 12 into i when g then i is pressed", () => {
    const engine = createRpnEngine();
    engine.setX(6);
    engine.gShift = true;

    engine.pressTvmI();

    expect(engine.financial.i).toBe(0.5);
    expect(engine.display).toBe(0.5);
    expect(engine.gShift).toBe(false);
    expect(engine.stackLiftEnabled).toBe(true);
  });
});

describe("RpnEngine — cash flows and NPV", () => {
  it("sets CF₀ from X when g then PV is pressed", () => {
    const engine = createRpnEngine();
    engine.setX(-1000);
    engine.gShift = true;

    engine.pressTvmPv();

    expect(engine.cashFlows).toEqual([-1000]);
    expect(engine.cashFlowCounts).toEqual([1]);
    expect(engine.financial.n).toBe(0);
    expect(engine.gShift).toBe(false);
  });

  it("appends CFⱼ when g then PMT is pressed", () => {
    const engine = createRpnEngine();
    engine.cashFlows = [-1000];
    engine.cashFlowCounts = [1];
    engine.setX(500);
    engine.gShift = true;

    engine.pressTvmPmt();

    expect(engine.cashFlows).toEqual([-1000, 500]);
    expect(engine.cashFlowCounts).toEqual([1, 1]);
    expect(engine.financial.n).toBe(1);
    expect(engine.gShift).toBe(false);
  });

  it("computes NPV when f then PV is pressed", () => {
    const engine = createRpnEngine();
    engine.cashFlows = [-1000, 500, 600];
    engine.financial.i = 10;
    engine.fShift = true;

    engine.pressTvmPv();

    expect(engine.display).toBeCloseTo(-49.586777, 4);
    expect(engine.fShift).toBe(false);
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("clears cash flows when FIN is invoked", () => {
    const engine = createRpnEngine();
    engine.cashFlows = [-1000, 500];
    engine.fShift = true;

    engine.swapXy();

    expect(engine.cashFlows).toEqual([]);
    expect(engine.financial).toEqual({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0 });
  });

  it("computes IRR when f then FV is pressed and stores it in i", () => {
    const engine = createRpnEngine();
    engine.cashFlows = [-1000, 500, 600];
    engine.cashFlowCounts = [1, 1, 1];
    engine.financial.i = 13;
    engine.fShift = true;

    engine.pressTvmFv();

    expect(engine.display).toBeCloseTo(6.394103, 4);
    expect(engine.financial.i).toBeCloseTo(6.394103, 4);
    expect(engine.fShift).toBe(false);
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("stores Nj for the last cash flow when g then FV is pressed", () => {
    const engine = createRpnEngine();
    engine.cashFlows = [-1000, 400];
    engine.cashFlowCounts = [1, 1];
    engine.setX(2);
    engine.gShift = true;

    engine.pressTvmFv();

    expect(engine.cashFlowCounts).toEqual([1, 2]);
    expect(engine.gShift).toBe(false);
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("uses Nj when computing NPV after grouped cash flows are entered", () => {
    const engine = createRpnEngine();
    engine.cashFlows = [-1000, 400];
    engine.cashFlowCounts = [1, 2];
    engine.financial.i = 10;
    engine.fShift = true;

    engine.pressTvmPv();

    expect(engine.display).toBeCloseTo(-305.785124, 4);
  });

  it("recalls the number of CFj amounts with RCL n in the manual NPV example", () => {
    const pressNumber = (value: string) => {
      for (const character of value) {
        if (character === ".") {
          engine.pressDecimal();
        } else {
          engine.pressDigit(character);
        }
      }
    };

    const engine = createRpnEngine();
    engine.fShift = true;
    engine.clx();

    pressNumber("80000");
    engine.chs();
    engine.gShift = true;
    engine.pressTvmPv();

    pressNumber("500");
    engine.chs();
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("4500");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("5500");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("4500");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("130000");
    engine.gShift = true;
    engine.pressTvmPmt();

    expect(engine.financial.n).toBe(5);

    engine.pressRcl();
    engine.pressTvmN();

    expect(engine.display).toBe(5);

    pressNumber("13");
    engine.pressTvmI();
    engine.fShift = true;
    engine.pressTvmPv();

    expect(engine.display).toBeCloseTo(212.18, 2);
  });

  it("recalls grouped CFj amount and Nj after storing the index in n", () => {
    const engine = createRpnEngine();
    engine.setX(-1000);
    engine.gShift = true;
    engine.pressTvmPv();
    engine.setX(400);
    engine.gShift = true;
    engine.pressTvmPmt();
    engine.setX(2);
    engine.gShift = true;
    engine.pressTvmFv();

    expect(engine.financial.n).toBe(1);
    expect(engine.cashFlows).toEqual([-1000, 400]);
    expect(engine.cashFlowCounts).toEqual([1, 2]);

    engine.pressRcl();
    engine.pressTvmN();
    expect(engine.display).toBe(1);

    engine.setX(1);
    engine.pressSto();
    engine.pressTvmN();

    engine.pressRcl();
    engine.gShift = true;
    engine.pressTvmFv();
    expect(engine.display).toBe(2);

    engine.setX(1);
    engine.pressSto();
    engine.pressTvmN();

    engine.pressRcl();
    engine.gShift = true;
    engine.pressTvmPmt();
    expect(engine.display).toBe(400);
  });

  it("recalls each CFj and Nj in a multi-flow grouped example", () => {
    const pressNumber = (value: string) => {
      for (const character of value) {
        if (character === ".") {
          engine.pressDecimal();
        } else {
          engine.pressDigit(character);
        }
      }
    };

    const storeCashFlowIndex = (index: number) => {
      engine.setX(index);
      engine.pressSto();
      engine.pressTvmN();
    };

    const recallCfj = () => {
      engine.pressRcl();
      engine.gShift = true;
      engine.pressTvmPmt();
    };

    const recallNj = () => {
      engine.pressRcl();
      engine.gShift = true;
      engine.pressTvmFv();
    };

    const engine = createRpnEngine();
    engine.setX(-1000);
    engine.gShift = true;
    engine.pressTvmPv();
    pressNumber("500");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("400");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("3");
    engine.gShift = true;
    engine.pressTvmFv();

    expect(engine.financial.n).toBe(2);
    expect(engine.cashFlowCounts).toEqual([1, 1, 3]);

    engine.pressRcl();
    engine.pressTvmN();
    expect(engine.display).toBe(2);

    storeCashFlowIndex(0);
    recallNj();
    expect(engine.display).toBe(1);
    recallCfj();
    expect(engine.display).toBe(-1000);

    storeCashFlowIndex(1);
    recallNj();
    expect(engine.display).toBe(1);
    recallCfj();
    expect(engine.display).toBe(500);

    storeCashFlowIndex(2);
    recallNj();
    expect(engine.display).toBe(3);
    recallCfj();
    expect(engine.display).toBe(400);
  });

  it("runs the manual grouped NPV example including RCL 5 and RCL g Nj", () => {
    const pressNumber = (value: string) => {
      for (const character of value) {
        if (character === ".") {
          engine.pressDecimal();
        } else {
          engine.pressDigit(character);
        }
      }
    };

    const engine = createRpnEngine();
    engine.fShift = true;
    engine.clx();

    pressNumber("79000");
    engine.chs();
    engine.gShift = true;
    engine.pressTvmPv();
    pressNumber("14000");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("11000");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("10000");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("3");
    engine.gShift = true;
    engine.pressTvmFv();
    pressNumber("9100");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("9000");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("2");
    engine.gShift = true;
    engine.pressTvmFv();
    pressNumber("4500");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("100000");
    engine.gShift = true;
    engine.pressTvmPmt();

    engine.pressRcl();
    engine.pressTvmN();
    expect(engine.display).toBe(7);

    pressNumber("13.5");
    engine.pressTvmI();
    engine.fShift = true;
    engine.pressTvmPv();
    expect(engine.display).toBeCloseTo(907.77, 2);

    engine.pressRcl();
    engine.pressDigit("5");
    expect(engine.display).toBe(9000);

    engine.pressDigit("5");
    engine.pressTvmN();
    expect(engine.display).toBe(5);
    expect(engine.financial.n).toBe(5);

    engine.pressRcl();
    engine.gShift = true;
    engine.pressTvmFv();
    expect(engine.display).toBe(2);

    engine.pressDigit("7");
    engine.pressTvmN();
    expect(engine.display).toBe(7);
    expect(engine.financial.n).toBe(7);
  });

  it("reviews all cash flows sequentially with repeated RCL g Nj and RCL g CFj", () => {
    const pressNumber = (value: string) => {
      for (const character of value) {
        if (character === ".") {
          engine.pressDecimal();
        } else {
          engine.pressDigit(character);
        }
      }
    };

    const recallNj = () => {
      engine.pressRcl();
      engine.gShift = true;
      engine.pressTvmFv();
    };

    const recallCfj = () => {
      engine.pressRcl();
      engine.gShift = true;
      engine.pressTvmPmt();
    };

    const engine = createRpnEngine();
    engine.fShift = true;
    engine.clx();

    pressNumber("79000");
    engine.chs();
    engine.gShift = true;
    engine.pressTvmPv();
    pressNumber("14000");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("11000");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("10000");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("3");
    engine.gShift = true;
    engine.pressTvmFv();
    pressNumber("9100");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("9000");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("2");
    engine.gShift = true;
    engine.pressTvmFv();
    pressNumber("4500");
    engine.gShift = true;
    engine.pressTvmPmt();
    pressNumber("100000");
    engine.gShift = true;
    engine.pressTvmPmt();

    expect(engine.financial.n).toBe(7);

    recallNj();
    expect(engine.display).toBe(1);
    recallCfj();
    expect(engine.display).toBe(100_000);
    expect(engine.financial.n).toBe(6);

    recallNj();
    expect(engine.display).toBe(1);
    recallCfj();
    expect(engine.display).toBe(4500);
    expect(engine.financial.n).toBe(5);

    recallNj();
    expect(engine.display).toBe(2);
    recallCfj();
    expect(engine.display).toBe(9000);
    expect(engine.financial.n).toBe(4);

    recallNj();
    expect(engine.display).toBe(1);
    recallCfj();
    expect(engine.display).toBe(9100);
    expect(engine.financial.n).toBe(3);

    recallNj();
    expect(engine.display).toBe(3);
    recallCfj();
    expect(engine.display).toBe(10_000);
    expect(engine.financial.n).toBe(2);

    recallNj();
    expect(engine.display).toBe(1);
    recallCfj();
    expect(engine.display).toBe(11_000);
    expect(engine.financial.n).toBe(1);

    recallNj();
    expect(engine.display).toBe(1);
    recallCfj();
    expect(engine.display).toBe(14_000);
    expect(engine.financial.n).toBe(0);

    recallNj();
    expect(engine.display).toBe(1);
    recallCfj();
    expect(engine.display).toBe(-79_000);
    expect(engine.financial.n).toBe(0);

    engine.pressDigit("7");
    engine.pressTvmN();
    expect(engine.financial.n).toBe(7);
  });
});

describe("RpnEngine — EEX scientific entry", () => {
  it("enters large numbers using mantissa and exponent from the reference example", () => {
    const engine = createRpnEngine();

    engine.pressDigit("1");
    engine.pressDecimal();
    engine.pressDigit("7");
    engine.pressDigit("8");
    engine.pressDigit("1");
    engine.pressDigit("4");
    engine.pressEex();
    engine.pressDigit("1");
    engine.pressDigit("2");

    expect(engine.display).toBeCloseTo(1781400000000, 0);
    expect(engine.getIsEnteringExponent()).toBe(true);
  });

  it("supports negative exponents with CHS after EEX", () => {
    const engine = createRpnEngine();

    engine.pressDigit("1");
    engine.pressDecimal();
    engine.pressDigit("5");
    engine.pressEex();
    engine.chs();
    engine.pressDigit("3");

    expect(engine.display).toBeCloseTo(0.0015, 12);
  });

  it("starts exponent entry from the committed value in X", () => {
    const engine = createRpnEngine();
    engine.setX(2.5);

    engine.pressEex();
    engine.pressDigit("4");

    expect(engine.display).toBe(25000);
    expect(engine.getIsEntering()).toBe(true);
  });

  it("ignores decimal points while entering the exponent", () => {
    const engine = createRpnEngine();

    engine.pressDigit("2");
    engine.pressEex();
    engine.pressDecimal();
    engine.pressDigit("5");

    expect(engine.display).toBe(200000);
    expect(engine.getExponentBuffer()).toBe("5");
  });

  it("limits exponent entry to two digits", () => {
    const engine = createRpnEngine();

    engine.pressDigit("1");
    engine.pressEex();
    engine.pressDigit("1");
    engine.pressDigit("2");
    engine.pressDigit("3");

    expect(engine.getExponentBuffer()).toBe("12");
    expect(engine.display).toBeCloseTo(1e12, 0);
  });

  it("commits scientific entry before binary operations", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 0, y: 100, z: 0, t: 0 });

    engine.pressDigit("1");
    engine.pressDecimal();
    engine.pressDigit("5");
    engine.pressEex();
    engine.pressDigit("3");
    engine.add();

    expect(engine.display).toBeCloseTo(1600, 0);
    expect(engine.getIsEntering()).toBe(false);
  });
});

describe("RpnEngine — math keys (1/x, y^x, √x, e^x)", () => {
  it("computes 1/x as a unary operation without stack drop", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 4, y: 9, z: 3, t: 7 });

    engine.reciprocal();

    expect(engine.display).toBe(0.25);
    expect(engine.getStack()).toEqual({ x: 0.25, y: 9, z: 3, t: 7 });
    expect(engine.lastX).toBe(4);
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("shows an error for reciprocal of zero", () => {
    const engine = createRpnEngine();
    engine.setX(0);

    engine.reciprocal();

    expect(engine.display).toBeNaN();
  });

  it("computes Y raised to the X power with stack drop", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 3, y: 2, z: 11, t: 13 });

    engine.yPowX();

    expect(engine.display).toBe(8);
    expect(engine.getStack()).toEqual({ x: 8, y: 11, z: 13, t: 13 });
    expect(engine.lastX).toBe(3);
  });

  it("routes g + y^x to square root of X", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 9, y: 5, z: 0, t: 0 });
    engine.gShift = true;

    engine.pressYPowXKey();

    expect(engine.display).toBe(3);
    expect(engine.getStack()).toEqual({ x: 3, y: 5, z: 0, t: 0 });
    expect(engine.gShift).toBe(false);
  });

  it("routes g + 1/x to e^x", () => {
    const engine = createRpnEngine();
    engine.setX(1);
    engine.gShift = true;

    engine.pressReciprocalKey();

    expect(engine.display).toBeCloseTo(Math.E, 10);
    expect(engine.gShift).toBe(false);
  });

  it("commits in-progress entry before 1/x", () => {
    const engine = createRpnEngine();

    engine.pressDigit("2");
    engine.reciprocal();

    expect(engine.display).toBe(0.5);
    expect(engine.getIsEntering()).toBe(false);
  });

  it("clears f shift after a math operation", () => {
    const engine = createRpnEngine();
    engine.setX(4);
    engine.fShift = true;

    engine.reciprocal();

    expect(engine.fShift).toBe(false);
  });
});

describe("RpnEngine — percentage keys (%, Δ%, %T) and LN", () => {
  it("computes X percent of Y and preserves Y", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 14, y: 300, z: 0, t: 0 });

    engine.percent();

    expect(engine.display).toBe(42);
    expect(engine.getStack()).toEqual({ x: 42, y: 300, z: 0, t: 0 });
    expect(engine.lastX).toBe(14);
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("computes percent change from Y to X for the stock example", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 53.25, y: 58.5, z: 0, t: 0 });

    engine.deltaPercent();

    expect(engine.display).toBeCloseTo(-8.97, 2);
    expect(engine.getStack().y).toBe(58.5);
  });

  it("computes what percent X is of Y for the sales example", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 2.36, y: 7.95, z: 0, t: 0 });

    engine.percentOfTotal();

    expect(engine.display).toBeCloseTo(29.69, 2);
    expect(engine.getStack().y).toBe(7.95);
  });

  it("runs the HP manual percent-of-total sales example end to end", () => {
    const engine = createRpnEngine();

    keyNumber(engine, "3.92");
    engine.enter();
    keyNumber(engine, "2.36");
    engine.add();
    keyNumber(engine, "1.67");
    engine.add();
    expect(engine.display).toBeCloseTo(7.95, 2);

    keyNumber(engine, "2.36");
    engine.pressPercentOfTotalKey();
    expect(engine.display).toBeCloseTo(29.69, 2);

    engine.clx();
    keyNumber(engine, "3.92");
    engine.pressPercentOfTotalKey();
    expect(engine.display).toBeCloseTo(49.31, 2);

    engine.clx();
    keyNumber(engine, "1.67");
    engine.pressPercentOfTotalKey();
    expect(engine.display).toBeCloseTo(21.01, 2);
  });

  it("computes percent of total from a keyed total with ENTER", () => {
    const engine = createRpnEngine();

    keyNumber(engine, "7.95");
    engine.enter();
    keyNumber(engine, "2.36");
    engine.pressPercentOfTotalKey();

    expect(engine.display).toBeCloseTo(29.69, 2);
  });

  it("CLX disables stack lift so the next digit replaces X", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 29.69, y: 7.95, z: 0, t: 0 });
    engine.stackLiftEnabled = true;

    engine.clx();
    keyNumber(engine, "3.92");

    expect(engine.getStack()).toEqual({ x: 3.92, y: 7.95, z: 0, t: 0 });
  });

  it("routes g + %T to natural log of X", () => {
    const engine = createRpnEngine();
    engine.setX(Math.E);
    engine.gShift = true;

    engine.pressPercentOfTotalKey();

    expect(engine.display).toBeCloseTo(1, 10);
    expect(engine.gShift).toBe(false);
  });

  it("routes g + Δ% to the fractional part of X", () => {
    const engine = createRpnEngine();
    engine.setX(3.75);
    engine.gShift = true;

    engine.pressDeltaPercentKey();

    expect(engine.display).toBeCloseTo(0.75, 10);
  });

  it("routes g + % to the integer part of X", () => {
    const engine = createRpnEngine();
    engine.setX(-3.75);
    engine.gShift = true;

    engine.pressPercentKey();

    expect(engine.display).toBe(-3);
  });

  it("shows an error for LN of a non-positive number", () => {
    const engine = createRpnEngine();
    engine.setX(0);
    engine.gShift = true;

    engine.pressPercentOfTotalKey();

    expect(engine.display).toBeNaN();
  });
});

describe("RpnEngine — AMORT, INT, and RND", () => {
  it("amortizes payments when f then n is pressed", () => {
    const engine = createRpnEngine();
    engine.financial = {
      n: 0,
      i: 13.25 / 12,
      pv: 50_000,
      pmt: -562.89,
      fv: 0,
    };
    engine.setX(1);
    engine.fShift = true;

    engine.pressTvmN();

    expect(engine.display).toBeCloseTo(-552.08, 2);
    expect(engine.getStack().y).toBeCloseTo(-10.81, 2);
    expect(engine.getStack().z).toBe(1);
    expect(engine.financial.pv).toBeCloseTo(49_989.19, 2);
    expect(engine.financial.n).toBe(1);
    expect(engine.fShift).toBe(false);
  });

  it("computes simple interest when f then i is pressed", () => {
    const engine = createRpnEngine();
    engine.financial = { n: 60, i: 7, pv: -450, pmt: 0, fv: 0 };
    engine.fShift = true;

    engine.pressTvmI();

    expect(engine.display).toBeCloseTo(5.25, 2);
    expect(engine.getStack().y).toBe(450);
    expect(engine.getStack().z).toBeCloseTo(5.18, 2);
    expect(engine.fShift).toBe(false);
  });

  it("adds principal to 360-day interest for the INT manual example", () => {
    const engine = createRpnEngine();
    engine.financial = { n: 60, i: 7, pv: -450, pmt: 0, fv: 0 };
    engine.fShift = true;
    engine.pressTvmI();
    engine.add();

    expect(engine.display).toBeCloseTo(455.25, 2);
  });

  it("shows 365-day interest after INT, R↓, and x↔y, then adds principal", () => {
    const engine = createRpnEngine();
    engine.financial = { n: 60, i: 7, pv: -450, pmt: 0, fv: 0 };
    engine.fShift = true;
    engine.pressTvmI();
    engine.rollDown();
    engine.swapXy();

    expect(engine.display).toBeCloseTo(5.18, 2);
    expect(engine.getStack().y).toBe(450);

    engine.add();

    expect(engine.display).toBeCloseTo(455.18, 2);
  });

  it("rounds X to the active display precision when f then PMT is pressed", () => {
    const engine = createRpnEngine();
    engine.setX(3.87654321);
    engine.decimalPlaces = 2;
    engine.fShift = true;

    engine.pressTvmPmt();

    expect(engine.display).toBe(3.88);
    expect(engine.fShift).toBe(false);
  });

  it("lets x↔y reveal amortized principal after f AMORT", () => {
    const engine = createRpnEngine();
    engine.financial = {
      n: 0,
      i: 13.25 / 12,
      pv: 50_000,
      pmt: -562.89,
      fv: 0,
    };
    engine.setX(1);
    engine.fShift = true;
    engine.pressTvmN();
    engine.swapXy();

    expect(engine.display).toBeCloseTo(-10.81, 2);
  });

  it("shows the amortized period count after x↔y and two roll downs", () => {
    const pressNumber = (value: string) => {
      for (const character of value) {
        if (character === ".") {
          engine.pressDecimal();
        } else {
          engine.pressDigit(character);
        }
      }
    };

    const engine = createRpnEngine();
    engine.fShift = true;
    engine.swapXy();
    pressNumber("13.25");
    engine.gShift = true;
    engine.pressTvmI();
    pressNumber("50000");
    engine.pressTvmPv();
    pressNumber("573.35");
    engine.chs();
    engine.pressTvmPmt();
    engine.gShift = true;
    engine.pressDigit("8");
    pressNumber("12");
    engine.fShift = true;
    engine.pressTvmN();

    expect(engine.display).toBeCloseTo(-6608.89, 2);
    expect(engine.getStack().z).toBe(12);

    engine.swapXy();
    expect(engine.display).toBeCloseTo(-271.31, 2);

    engine.rollDown();
    engine.rollDown();
    expect(engine.display).toBe(12);
    expect(engine.financial.pv).toBeCloseTo(49_728.69, 2);
    expect(engine.financial.n).toBe(12);

    pressNumber("12");
    engine.fShift = true;
    engine.pressTvmN();
    engine.swapXy();
    expect(engine.display).toBeCloseTo(-309.48, 2);
    engine.rollDown();
    engine.rollDown();
    expect(engine.display).toBe(12);
    expect(engine.financial.pv).toBeCloseTo(49_419.21, 2);
    expect(engine.financial.n).toBe(24);
  });

  it("matches reference key sequences for AMORT, INT, and RND", () => {
    const pressNumber = (engine: ReturnType<typeof createRpnEngine>, value: string) => {
      for (const character of value) {
        if (character === ".") {
          engine.pressDecimal();
        } else {
          engine.pressDigit(character);
        }
      }
    };

    const amortEngine = createRpnEngine();
    amortEngine.fShift = true;
    amortEngine.swapXy();
    pressNumber(amortEngine, "13.25");
    amortEngine.gShift = true;
    amortEngine.pressTvmI();
    pressNumber(amortEngine, "50000");
    amortEngine.pressTvmPv();
    pressNumber(amortEngine, "562.89");
    amortEngine.chs();
    amortEngine.pressTvmPmt();
    pressNumber(amortEngine, "0");
    amortEngine.pressTvmN();
    pressNumber(amortEngine, "1");
    amortEngine.fShift = true;
    amortEngine.pressTvmN();

    expect(amortEngine.display).toBeCloseTo(-552.08, 2);
    amortEngine.swapXy();
    expect(amortEngine.display).toBeCloseTo(-10.81, 2);

    const intEngine = createRpnEngine();
    pressNumber(intEngine, "60");
    intEngine.pressTvmN();
    pressNumber(intEngine, "7");
    intEngine.pressTvmI();
    pressNumber(intEngine, "450");
    intEngine.chs();
    intEngine.pressTvmPv();
    intEngine.fShift = true;
    intEngine.pressTvmI();

    expect(intEngine.display).toBeCloseTo(5.25, 2);

    const rndEngine = createRpnEngine();
    pressNumber(rndEngine, "3.87654321");
    rndEngine.fShift = true;
    rndEngine.pressDigit("2");

    expect(
      formatLcdDisplay({
        value: rndEngine.display,
        isEntering: false,
        inputBuffer: "",
        decimalPlaces: rndEngine.decimalPlaces,
      }),
    ).toBe("3.88");
    expect(rndEngine.display).toBeCloseTo(3.87654321, 8);

    rndEngine.fShift = true;
    rndEngine.pressTvmPmt();

    expect(rndEngine.display).toBe(3.88);
  });
});

describe("RpnEngine — statistics (Σ+, Σ−, mean, s)", () => {
  it("accumulates one-variable data with Σ+ and shows n in X", () => {
    const engine = createRpnEngine();
    engine.fShift = true;
    engine.pressSst();

    for (const value of [2, 4, 6]) {
      engine.setX(value);
      engine.sigmaPlus();
    }

    expect(engine.display).toBe(3);
    expect(engine.getStatistics().n).toBe(3);
  });

  it("computes the mean when g then 0 is pressed", () => {
    const engine = createRpnEngine();

    for (const value of [2, 4, 6]) {
      engine.setX(value);
      engine.sigmaPlus();
    }

    engine.gShift = true;
    engine.pressDigit("0");

    expect(engine.display).toBe(4);
    expect(engine.gShift).toBe(false);
  });

  it("computes the sample standard deviation when g then . is pressed", () => {
    const engine = createRpnEngine();

    for (const value of [2, 4, 6]) {
      engine.setX(value);
      engine.sigmaPlus();
    }

    engine.gShift = true;
    engine.pressDecimal();

    expect(engine.display).toBe(2);
  });

  it("removes a data point with g Σ−", () => {
    const engine = createRpnEngine();

    for (const value of [2, 4, 6]) {
      engine.setX(value);
      engine.sigmaPlus();
    }

    engine.setX(4);
    engine.gShift = true;
    engine.pressSigmaKey();

    expect(engine.display).toBe(2);
    engine.gShift = true;
    engine.pressDigit("0");
    expect(engine.display).toBe(4);
  });

  it("clears statistics when f then SST is pressed", () => {
    const engine = createRpnEngine();
    engine.setX(12);
    engine.sigmaPlus();
    engine.fShift = true;

    engine.pressSst();

    expect(engine.getStatistics().n).toBe(0);
    expect(engine.display).toBe(0);
    expect(engine.getStack()).toEqual({ x: 0, y: 0, z: 0, t: 0 });
    expect(engine.fShift).toBe(false);
  });

  it("accumulates two-variable pairs in Y then X order", () => {
    const engine = createRpnEngine();
    engine.setX(10);
    engine.enter();
    engine.setX(3);
    engine.sigmaPlus();
    engine.setX(20);
    engine.enter();
    engine.setX(5);
    engine.sigmaPlus();

    expect(engine.getStatistics()).toMatchObject({
      n: 2,
      sumX: 8,
      sumY: 30,
      sumXY: 130,
    });
  });

  it("computes the mean of y when g then 2 is pressed", () => {
    const engine = createRpnEngine();
    engine.setX(10);
    engine.enter();
    engine.setX(3);
    engine.sigmaPlus();
    engine.setX(20);
    engine.enter();
    engine.setX(5);
    engine.sigmaPlus();

    engine.gShift = true;
    engine.pressDigit("2");

    expect(engine.display).toBe(15);
  });

  it("computes weighted mean when g then 6 is pressed", () => {
    const engine = createRpnEngine();
    engine.setX(1.16);
    engine.enter();
    engine.setX(15);
    engine.sigmaPlus();
    engine.setX(1.24);
    engine.enter();
    engine.setX(7);
    engine.sigmaPlus();
    engine.setX(1.2);
    engine.enter();
    engine.setX(10);
    engine.sigmaPlus();
    engine.setX(1.18);
    engine.enter();
    engine.setX(17);
    engine.sigmaPlus();

    engine.gShift = true;
    engine.pressDigit("6");

    expect(engine.display).toBeCloseTo(1.19, 2);
  });

  it("shows sample sy after g . then x swap y", () => {
    const engine = createRpnEngine();
    engine.setX(10);
    engine.enter();
    engine.setX(3);
    engine.sigmaPlus();
    engine.setX(20);
    engine.enter();
    engine.setX(5);
    engine.sigmaPlus();

    engine.gShift = true;
    engine.pressDecimal();

    expect(engine.display).toBeCloseTo(1.41, 2);

    engine.swapXy();

    expect(engine.display).toBeCloseTo(7.07, 2);
  });

  it("shows sample sy on a second g . press without x swap y", () => {
    const engine = createRpnEngine();
    engine.setX(10);
    engine.enter();
    engine.setX(3);
    engine.sigmaPlus();
    engine.setX(20);
    engine.enter();
    engine.setX(5);
    engine.sigmaPlus();

    engine.gShift = true;
    engine.pressDecimal();
    engine.gShift = true;
    engine.pressDecimal();

    expect(engine.display).toBeCloseTo(7.07, 2);
  });

  it("accumulates and recalls sx/sy using digit entry keystrokes", () => {
    const engine = createRpnEngine();
    engine.fShift = true;
    engine.pressSst();

    engine.pressDigit("1");
    engine.pressDigit("0");
    engine.pressEnter();
    engine.pressDigit("3");
    engine.pressSigmaKey();
    engine.pressDigit("2");
    engine.pressDigit("0");
    engine.pressEnter();
    engine.pressDigit("5");
    engine.pressSigmaKey();

    engine.gShift = true;
    engine.pressDecimal();
    expect(engine.display).toBeCloseTo(1.41, 2);

    engine.swapXy();
    expect(engine.display).toBeCloseTo(7.07, 2);
  });

  it("does not leave a stale mean toggle after g 2 before g . and x swap y", () => {
    const engine = createRpnEngine();
    engine.setX(10);
    engine.enter();
    engine.setX(3);
    engine.sigmaPlus();
    engine.setX(20);
    engine.enter();
    engine.setX(5);
    engine.sigmaPlus();

    engine.gShift = true;
    engine.pressDigit("0");
    engine.gShift = true;
    engine.pressDigit("2");
    engine.gShift = true;
    engine.pressDecimal();
    engine.swapXy();

    expect(engine.display).toBeCloseTo(7.07, 2);
  });

  it("computes correlation when g then 1 is pressed", () => {
    const engine = createRpnEngine();
    engine.setX(0);
    engine.enter();
    engine.setX(0);
    engine.sigmaPlus();
    engine.setX(6);
    engine.enter();
    engine.setX(4);
    engine.sigmaPlus();

    engine.gShift = true;
    engine.pressDigit("1");

    expect(engine.display).toBe(1);
  });
});

describe("RpnEngine — linear regression (ŷ and x̂)", () => {
  function enterPair(engine: ReturnType<typeof createRpnEngine>, y: number, x: number) {
    engine.setX(y);
    engine.enter();
    engine.setX(x);
    engine.sigmaPlus();
  }

  it("forecasts ŷ and x̂ for the regression reference example", () => {
    const engine = createRpnEngine();
    engine.fShift = true;
    engine.pressSst();

    enterPair(engine, 1, -2);
    enterPair(engine, 4, 7);

    engine.setX(0);
    engine.gShift = true;
    engine.pressMultiplyKey();

    expect(engine.display).toBeCloseTo(1.67, 2);
    expect(engine.getStack().y).toBe(1);

    engine.setX(5);
    engine.gShift = true;
    engine.pressSubtractKey();

    expect(engine.display).toBeCloseTo(10, 1);
  });

  it("shows correlation after a linear forecast when x swap y is pressed", () => {
    const engine = createRpnEngine();
    enterPair(engine, 1, -2);
    enterPair(engine, 4, 7);

    engine.setX(3);
    engine.gShift = true;
    engine.pressMultiplyKey();
    engine.swapXy();

    expect(engine.display).toBe(1);
  });

  it("computes slope via forecast at x=1 minus intercept", () => {
    const engine = createRpnEngine();
    enterPair(engine, 1, -2);
    enterPair(engine, 4, 7);

    engine.setX(0);
    engine.gShift = true;
    engine.pressMultiplyKey();
    const intercept = engine.display;

    engine.setX(1);
    engine.gShift = true;
    engine.pressMultiplyKey();

    expect(engine.display - intercept).toBeCloseTo(0.33, 2);
  });
});

describe("RpnEngine — calendar (DATE, ΔDYS, date format)", () => {
  it("adds days with g CHS (DATE) and formats the result for the LCD", () => {
    const engine = createRpnEngine();
    engine.gShift = true;
    engine.pressDigit("4");

    expect(engine.getDateFormat()).toBe("dmy");
    expect(engine.getShowDmyAnnunciator()).toBe(true);

    engine.setStack({ x: 120, y: 14.052004, z: 0, t: 0 });
    engine.gShift = true;
    engine.chs();

    expect(engine.getStack().x).toBeCloseTo(11.092004, 6);
    expect(engine.getStack().y).toBe(6);
    expect(engine.getCalendarDisplayText()).toBe("11.09.2004 6");
  });

  it("computes ΔDYS with g EEX and shows 30/360 days after x↔y", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 10.142005, y: 6.032004, z: 0, t: 0 });

    engine.gShift = true;
    engine.pressEex();

    expect(engine.display).toBe(498);
    expect(engine.getStack().y).toBe(491);
    expect(engine.getCalendarDisplayText()).toBeNull();

    engine.swapXy();

    expect(engine.display).toBe(491);
  });

  it("switches between D.MY and M.DY with g 4 and g 5", () => {
    const engine = createRpnEngine();

    engine.gShift = true;
    engine.pressDigit("4");
    expect(engine.getDateFormat()).toBe("dmy");
    expect(engine.getShowDmyAnnunciator()).toBe(true);
    expect(engine.decimalPlaces).toBe(6);

    engine.gShift = true;
    engine.pressDigit("5");
    expect(engine.getDateFormat()).toBe("mdy");
    expect(engine.getShowDmyAnnunciator()).toBe(false);
    expect(engine.decimalPlaces).toBe(6);
  });

  it("rejects a D.MY date when M.DY mode is active", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 120, y: 14.052004, z: 0, t: 0 });
    engine.gShift = true;
    engine.chs();

    expect(Number.isNaN(engine.display)).toBe(true);
  });

  it("rejects truncated two-decimal dates", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 10.14, y: 6.03, z: 0, t: 0 });
    engine.gShift = true;
    engine.pressEex();

    expect(Number.isNaN(engine.display)).toBe(true);
  });
});

describe("RpnEngine — calendar keystroke entry", () => {
  function typeNum(engine: ReturnType<typeof createRpnEngine>, s: string): void {
    for (const ch of s) {
      if (ch === ".") {
        engine.pressDecimal();
      } else {
        engine.pressDigit(ch);
      }
    }
  }

  it("DATE manual example via digit entry", () => {
    const engine = createRpnEngine();
    engine.gShift = true;
    engine.pressDigit("4");
    typeNum(engine, "14.052004");
    engine.pressEnter();
    typeNum(engine, "120");
    engine.gShift = true;
    engine.chs();

    expect(engine.getCalendarDisplayText()).toBe("11.09.2004 6");
  });

  it("ΔDYS manual example via digit entry", () => {
    const engine = createRpnEngine();
    engine.gShift = true;
    engine.pressDigit("5");
    typeNum(engine, "6.032004");
    engine.pressEnter();
    typeNum(engine, "10.142005");
    engine.gShift = true;
    engine.pressEex();

    expect(engine.display).toBe(498);
    engine.swapXy();
    expect(engine.display).toBe(491);
  });

  it("shows a committed M.DY date to hundredths on ENTER while keeping full precision", () => {
    const engine = createRpnEngine();
    engine.gShift = true;
    engine.pressDigit("5");
    typeNum(engine, "2.151981");
    engine.pressEnter();

    expect(engine.decimalPlaces).toBe(2);
    expect(engine.display).toBeCloseTo(2.151981, 6);
    expect(
      formatLcdDisplay({
        value: engine.display,
        isEntering: false,
        inputBuffer: "",
        decimalPlaces: engine.decimalPlaces,
      }),
    ).toBe("2.15");

    typeNum(engine, "3.011981");
    expect(engine.decimalPlaces).toBe(2);
    expect(
      formatLcdDisplay({
        value: engine.display,
        isEntering: engine.getIsEntering(),
        inputBuffer: engine.getInputBuffer(),
        decimalPlaces: engine.decimalPlaces,
      }),
    ).toBe("3.011981");
  });
});

describe("RpnEngine — factorial (n!)", () => {
  it("computes n! with g + 3", () => {
    const engine = createRpnEngine();
    engine.setX(5);
    engine.gShift = true;
    engine.pressDigit("3");

    expect(engine.display).toBe(120);
    expect(engine.gShift).toBe(false);
    expect(engine.stackLiftEnabled).toBe(true);
  });

  it("returns overflow for 70!", () => {
    const engine = createRpnEngine();
    engine.setX(70);
    engine.gShift = true;
    engine.pressDigit("3");

    expect(engine.display).toBe(9.999999999e99);
  });

  it("returns Error for non-integer factorial", () => {
    const engine = createRpnEngine();
    engine.setX(4.5);
    engine.gShift = true;
    engine.pressDigit("3");

    expect(Number.isNaN(engine.display)).toBe(true);
  });
});

describe("RpnEngine — comparisons and editing", () => {
  it("returns 1 when X ≤ Y via g + x↔y", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 3, y: 5, z: 0, t: 0 });
    engine.gShift = true;
    engine.swapXy();

    expect(engine.display).toBe(1);
  });

  it("returns 0 when X > Y via g + x↔y", () => {
    const engine = createRpnEngine();
    engine.setStack({ x: 7, y: 5, z: 0, t: 0 });
    engine.gShift = true;
    engine.swapXy();

    expect(engine.display).toBe(0);
  });

  it("counts x = 0 pairs via g + CLx", () => {
    const engine = createRpnEngine();
    engine.setX(1);
    engine.enter();
    engine.setX(0);
    engine.sigmaPlus();
    engine.setX(2);
    engine.enter();
    engine.setX(0);
    engine.sigmaPlus();

    engine.gShift = true;
    engine.clx();

    expect(engine.display).toBe(2);
  });

  it("deletes the last digit via g + SST", () => {
    const engine = createRpnEngine();
    engine.pressDigit("1");
    engine.pressDigit("2");
    engine.pressDigit("3");
    engine.gShift = true;
    engine.pressSst();

    expect(engine.getInputBuffer()).toBe("12");
    expect(engine.display).toBe(12);
  });
});

describe("RpnEngine — PREFIX (f + ENTER)", () => {
  it("shows all 10 mantissa digits of X", () => {
    const engine = createRpnEngine();
    engine.setX(14.8745632);
    engine.fShift = true;
    engine.pressEnter();

    expect(engine.getPrefixMantissaDisplayText()).toBe("1487456320");
    expect(engine.fShift).toBe(false);
  });

  it("cancels armed STO prefix and f shift", () => {
    const engine = createRpnEngine();
    engine.setX(5);
    engine.pressSto();
    engine.fShift = true;
    engine.pressEnter();

    expect(engine.getMemoryPrefix()).toBeNull();
    expect(engine.fShift).toBe(false);
    expect(engine.getPrefixMantissaDisplayText()).toBe("5000000000");
  });

  it("clears mantissa display on the next operation", () => {
    const engine = createRpnEngine();
    engine.setX(14.8745632);
    engine.fShift = true;
    engine.pressEnter();

    expect(engine.getPrefixMantissaDisplayText()).not.toBeNull();

    engine.setStack({ x: 1, y: 2, z: 0, t: 0 });
    engine.add();

    expect(engine.getPrefixMantissaDisplayText()).toBeNull();
  });
});

describe("RpnEngine — depreciation (SL, SOYD, DB)", () => {
  function loadMetalworkingExample(engine: ReturnType<typeof createRpnEngine>) {
    engine.financial = { n: 5, i: 200, pv: 10000, pmt: 0, fv: 500 };
  }

  it("computes DB depreciation with f + %", () => {
    const engine = createRpnEngine();
    loadMetalworkingExample(engine);
    engine.setX(1);
    engine.fShift = true;
    engine.pressPercentKey();

    expect(engine.display).toBe(4000);
    expect(engine.getStack().y).toBe(5500);
  });

  it("computes SL depreciation with f + %T", () => {
    const engine = createRpnEngine();
    engine.financial = { n: 12, i: 0, pv: 28000, pmt: 0, fv: 2500 };
    engine.setX(1);
    engine.fShift = true;
    engine.pressPercentOfTotalKey();

    expect(engine.display).toBeCloseTo(2125, 2);
  });

  it("computes SOYD depreciation with f + Δ%", () => {
    const engine = createRpnEngine();
    engine.financial = { n: 8, i: 0, pv: 15000, pmt: 0, fv: 1100 };
    engine.setX(4);
    engine.fShift = true;
    engine.pressDeltaPercentKey();

    expect(engine.display).toBeCloseTo(1930.56, 2);
  });

  it("shows remaining depreciable value after x↔y", () => {
    const engine = createRpnEngine();
    loadMetalworkingExample(engine);
    engine.setX(3);
    engine.fShift = true;
    engine.pressPercentKey();
    engine.swapXy();

    expect(engine.display).toBe(1660);
  });
});

describe("RpnEngine — bond (PRICE and YTM)", () => {
  const TREASURY = {
    settlement: 4.282004,
    maturity: 6.042018,
    coupon: 6.75,
  };

  function loadTreasuryDates(engine: ReturnType<typeof createRpnEngine>) {
    engine.financial = {
      n: 0,
      i: 8.25,
      pv: 0,
      pmt: TREASURY.coupon,
      fv: 0,
    };
    engine.setStack({
      x: TREASURY.maturity,
      y: TREASURY.settlement,
      z: 0,
      t: 0,
    });
  }

  it("computes PRICE with f + y^x", () => {
    const engine = createRpnEngine();
    loadTreasuryDates(engine);
    engine.fShift = true;
    engine.pressYPowXKey();

    expect(engine.display).toBeCloseTo(87.62, 2);
    expect(engine.financial.pv).toBeCloseTo(87.62, 2);
    expect(engine.getStack().y).toBeCloseTo(2.69, 2);
  });

  it("shows accrued interest after PRICE via x↔y", () => {
    const engine = createRpnEngine();
    loadTreasuryDates(engine);
    engine.fShift = true;
    engine.pressYPowXKey();
    engine.swapXy();

    expect(engine.display).toBeCloseTo(2.69, 2);
  });

  it("computes YTM with f + 1/x", () => {
    const engine = createRpnEngine();
    engine.financial = {
      n: 0,
      i: 0,
      pv: 88.38,
      pmt: TREASURY.coupon,
      fv: 0,
    };
    engine.setStack({
      x: TREASURY.maturity,
      y: TREASURY.settlement,
      z: 0,
      t: 0,
    });
    engine.fShift = true;
    engine.pressReciprocalKey();

    expect(engine.display).toBeCloseTo(8.15, 2);
    expect(engine.financial.i).toBeCloseTo(8.15, 2);
  });
});

describe("RpnEngine — odd-period compound interest (STO EEX)", () => {
  function typeNum(engine: RpnEngine, s: string): void {
    for (const ch of s) {
      if (ch === ".") {
        engine.pressDecimal();
      } else {
        engine.pressDigit(ch);
      }
    }
  }

  it("toggles the C annunciator with STO then EEX without entering scientific mode", () => {
    const engine = createRpnEngine();

    engine.pressSto();
    engine.pressEex();

    expect(engine.compoundOddPeriod).toBe(true);
    expect(engine.getShowCompoundOddAnnunciator()).toBe(true);
    expect(engine.getIsEnteringExponent()).toBe(false);
    expect(engine.getMemoryPrefix()).toBeNull();

    engine.pressSto();
    engine.pressEex();

    expect(engine.compoundOddPeriod).toBe(false);
  });

  it("still enters scientific notation when EEX is pressed without STO", () => {
    const engine = createRpnEngine();
    engine.setX(1.5);

    engine.pressEex();
    engine.pressDigit("3");

    expect(engine.getIsEnteringExponent()).toBe(true);
    expect(engine.compoundOddPeriod).toBe(false);
  });

  it("clears the C annunciator on REG (f CLx)", () => {
    const engine = createRpnEngine();
    engine.compoundOddPeriod = true;
    engine.fShift = true;

    engine.clx();

    expect(engine.compoundOddPeriod).toBe(false);
  });

  it("runs the HP manual odd-days loan example end to end", () => {
    const engine = createRpnEngine();

    engine.fShift = true;
    engine.swapXy();

    engine.gShift = true;
    engine.pressDigit("5");

    engine.gShift = true;
    engine.pressDigit("8");

    engine.pressSto();
    engine.pressEex();
    expect(engine.compoundOddPeriod).toBe(true);

    typeNum(engine, "2.151981");
    engine.pressEnter();
    typeNum(engine, "3.011981");

    engine.gShift = true;
    engine.pressEex();
    expect(engine.display).toBe(14);
    expect(engine.getStack().y).toBe(16);

    engine.swapXy();
    expect(engine.display).toBe(16);

    typeNum(engine, "30");
    engine.divide();
    expect(engine.display).toBeCloseTo(0.53, 2);

    typeNum(engine, "36");
    engine.add();
    expect(engine.display).toBeCloseTo(36.53, 2);
    engine.pressTvmN();
    expect(engine.financial.n).toBeCloseTo(36.53, 2);

    typeNum(engine, "15");
    engine.gShift = true;
    engine.pressTvmI();
    expect(engine.financial.i).toBeCloseTo(1.25, 2);

    typeNum(engine, "4500");
    engine.pressTvmPv();
    expect(engine.financial.pv).toBe(4500);

    engine.pressTvmPmt();
    expect(engine.display).toBeCloseTo(-157.03, 2);
  });
});
