/** Internal working precision for stack and TVM values. */
export const INTERNAL_PRECISION = 12;

export function roundToInternalPrecision(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  if (value === 0) {
    return 0;
  }

  return Number(value.toPrecision(INTERNAL_PRECISION));
}
