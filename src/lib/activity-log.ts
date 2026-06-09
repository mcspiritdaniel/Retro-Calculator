import { formatLcdDisplay, type LcdDisplayFormat } from "./lcd-format";
import { describeKeystroke } from "./key-descriptions";
import type { MemoryPrefix, RpnEngineSnapshot, StackRegisters } from "./rpn-engine";

export type ActivityLogEntry = {
  id: number;
  step: number;
  keyLabel: string;
  display: string;
  stack: StackRegisters;
  note: string | null;
};

export function buildKeyLabel(
  engine: {
    fShift: boolean;
    gShift: boolean;
    getMemoryPrefix(): MemoryPrefix | null;
  },
  baseKey: string,
): string {
  const parts: string[] = [];
  const memoryPrefix = engine.getMemoryPrefix();

  if (memoryPrefix === "sto") {
    parts.push("STO");
  } else if (memoryPrefix === "rcl") {
    parts.push("RCL");
  }

  if (engine.fShift) {
    parts.push("f");
  }

  if (engine.gShift) {
    parts.push("g");
  }

  parts.push(baseKey);
  return parts.join(" ");
}

export function formatLogStackValue(
  value: number,
  decimalPlaces: number,
  displayFormat: LcdDisplayFormat = "fix",
): string {
  if (!Number.isFinite(value)) {
    return "Error";
  }

  return formatLcdDisplay({
    value,
    isEntering: false,
    inputBuffer: "",
    decimalPlaces,
    displayFormat,
  }).trim();
}

export function createActivityLogEntry(
  id: number,
  step: number,
  keyLabel: string,
  display: string,
  snapshot: RpnEngineSnapshot,
): ActivityLogEntry {
  return {
    id,
    step,
    keyLabel,
    display: display.trim(),
    stack: { ...snapshot.stack },
    note: describeKeystroke(keyLabel),
  };
}
