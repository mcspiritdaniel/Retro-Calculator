import { describe, expect, it } from "vitest";
import { formatLogStackValue } from "@/lib/activity-log";
import { createRpnEngine } from "@/lib/rpn-engine";

/** Snapshot fields the Registers pane displays — kept in sync with RegistersPanel. */
describe("Registers pane snapshot contract", () => {
  it("starts with cleared stack, TVM, and default mode", () => {
    const snapshot = createRpnEngine().getSnapshot();

    expect(snapshot.stack).toEqual({ x: 0, y: 0, z: 0, t: 0 });
    expect(snapshot.financial).toEqual({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0 });
    expect(snapshot.fShift).toBe(false);
    expect(snapshot.gShift).toBe(false);
    expect(snapshot.decimalPlaces).toBe(2);
    expect(snapshot.paymentMode).toBe("end");
    expect(snapshot.dateFormat).toBe("mdy");
    expect(snapshot.memoryPrefix).toBeNull();
    expect(snapshot.cashFlows).toEqual([]);
  });

  it("tracks stack through RPN entry and arithmetic", () => {
    const engine = createRpnEngine();

    engine.pressDigit("5");
    engine.pressEnter();
    expect(engine.getSnapshot().stack).toEqual({ x: 5, y: 5, z: 0, t: 0 });

    engine.pressDigit("3");
    expect(engine.getSnapshot().stack).toEqual({ x: 3, y: 5, z: 0, t: 0 });

    engine.add();

    const snapshot = engine.getSnapshot();

    expect(snapshot.stack).toEqual({ x: 8, y: 0, z: 0, t: 0 });
    expect(formatLogStackValue(snapshot.stack.x, snapshot.decimalPlaces)).toBe(
      "8.00",
    );
  });

  it("keeps register X aligned with the display while entering digits", () => {
    const engine = createRpnEngine();

    engine.pressDigit("1");
    engine.pressDecimal();
    engine.pressDigit("5");

    const snapshot = engine.getSnapshot();

    expect(snapshot.isEntering).toBe(true);
    expect(snapshot.stack.x).toBe(1.5);
    expect(formatLogStackValue(snapshot.stack.x, snapshot.decimalPlaces)).toBe(
      "1.50",
    );
  });

  it("stores TVM registers from X and reflects them on snapshot", () => {
    const engine = createRpnEngine();

    engine.pressDigit("3");
    engine.pressDigit("6");
    engine.pressDigit("0");
    engine.pressTvmN();

    engine.pressDigit("6");
    engine.pressTvmI();

    const snapshot = engine.getSnapshot();

    expect(snapshot.financial.n).toBe(360);
    expect(snapshot.financial.i).toBe(6);
  });

  it("recalls TVM registers into X via RCL prefix", () => {
    const engine = createRpnEngine();

    engine.setX(1200);
    engine.pressSto();
    engine.pressTvmPv();

    engine.setX(0);
    engine.pressRcl();
    engine.pressTvmPv();

    const snapshot = engine.getSnapshot();

    expect(snapshot.financial.pv).toBe(1200);
    expect(snapshot.stack.x).toBe(1200);
    expect(snapshot.memoryPrefix).toBeNull();
  });

  it("shows armed STO/RCL prefix before the target key", () => {
    const engine = createRpnEngine();

    engine.pressSto();

    expect(engine.getSnapshot().memoryPrefix).toBe("sto");

    engine.pressRcl();

    expect(engine.getSnapshot().memoryPrefix).toBe("rcl");
  });

  it("reflects f/g shifts, payment timing, date format, and display precision", () => {
    const engine = createRpnEngine();

    engine.fShift = true;
    expect(engine.getSnapshot().fShift).toBe(true);

    engine.gShift = true;
    const toggled = engine.getSnapshot();
    expect(toggled.gShift).toBe(true);

    engine.gShift = true;
    engine.pressDigit("7");
    expect(engine.getSnapshot().paymentMode).toBe("beg");

    engine.gShift = true;
    engine.pressDigit("8");
    expect(engine.getSnapshot().paymentMode).toBe("end");

    engine.gShift = true;
    engine.pressDigit("4");
    expect(engine.getSnapshot().dateFormat).toBe("dmy");

    engine.fShift = true;
    engine.pressDigit("4");
    expect(engine.getSnapshot().decimalPlaces).toBe(4);
  });

  it("counts cash flows after CFo and CFj", () => {
    const engine = createRpnEngine();

    engine.setX(-1000);
    engine.gShift = true;
    engine.pressTvmPv();
    expect(engine.getSnapshot().cashFlows).toEqual([-1000]);

    engine.setX(300);
    engine.gShift = true;
    engine.pressTvmPmt();
    expect(engine.getSnapshot().cashFlows).toEqual([-1000, 300]);
  });
});
