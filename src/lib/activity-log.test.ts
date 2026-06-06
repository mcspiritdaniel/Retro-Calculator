import { describe, expect, it } from "vitest";
import { buildKeyLabel, createActivityLogEntry } from "./activity-log";
import { createRpnEngine } from "./rpn-engine";

describe("buildKeyLabel", () => {
  it("includes f shift and memory prefix", () => {
    const engine = createRpnEngine();
    engine.fShift = true;
    engine.pressSto();

    expect(buildKeyLabel(engine, "7")).toBe("STO f 7");
  });

  it("builds log entries with optional notes", () => {
    const engine = createRpnEngine();
    engine.fShift = true;
    engine.pressYPowXKey();

    const entry = createActivityLogEntry(
      1,
      1,
      "f y^x",
      "87.62",
      engine.getSnapshot(),
    );

    expect(entry.note).toMatch(/Bond PRICE/);
    expect(entry.stack.x).toBeDefined();
  });
});
