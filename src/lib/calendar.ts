/** Calendar date format (g + 4 / g + 5). */
export type DateFormat = "mdy" | "dmy";

export type ParsedDate = {
  year: number;
  month: number;
  day: number;
};

export type DateResult = {
  encoded: number;
  weekday: number;
};

export type DaysBetweenResult = {
  actual: number;
  days360: number;
};

const MIN_GREGORIAN = new Date(Date.UTC(1582, 9, 15));
const MAX_GREGORIAN = new Date(Date.UTC(4046, 10, 25));

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function fractionalDigits(value: number): string {
  const magnitude = Math.abs(value);
  const fractionInt = Math.round((magnitude % 1) * 1_000_000);
  return fractionInt.toString().padStart(6, "0");
}

/** Decode an encoded date register (mm.ddyyyy or dd.mmyyyy). */
export function parseEncodedDate(value: number, format: DateFormat): ParsedDate | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const magnitude = Math.abs(value);
  const integerPart = Math.trunc(magnitude);
  const fraction = fractionalDigits(magnitude);

  const day =
    format === "dmy" ? integerPart : parseInt(fraction.slice(0, 2), 10);
  const month =
    format === "dmy" ? parseInt(fraction.slice(0, 2), 10) : integerPart;
  const year = parseInt(fraction.slice(2, 6), 10);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1582 ||
    year > 4046
  ) {
    return null;
  }

  const utc = Date.UTC(year, month - 1, day);
  const parsed = new Date(utc);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  if (parsed < MIN_GREGORIAN || parsed > MAX_GREGORIAN) {
    return null;
  }

  return { year, month, day };
}

/** Encode calendar parts into a date register. */
export function encodeDate(
  { year, month, day }: ParsedDate,
  format: DateFormat,
): number {
  const tail = `${pad2(format === "dmy" ? month : day)}${year
    .toString()
    .padStart(4, "0")}`;
  const head = format === "dmy" ? day : month;
  return head + parseInt(tail, 10) / 1_000_000;
}

/** Weekday encoding: 1 = Monday … 7 = Sunday. */
export function weekdayForDate({ year, month, day }: ParsedDate): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function formatCalendarDate(
  encoded: number,
  weekday: number,
  format: DateFormat,
): string {
  const parsed = parseEncodedDate(encoded, format);
  if (!parsed) {
    return " Error ";
  }

  const { year, month, day } = parsed;
  const dateText =
    format === "dmy"
      ? `${day}.${pad2(month)}.${year}`
      : `${month}.${pad2(day)}.${year}`;

  return `${dateText} ${weekday}`;
}

export function addDaysToDate(
  encoded: number,
  days: number,
  format: DateFormat,
): DateResult | null {
  const parsed = parseEncodedDate(encoded, format);
  if (!parsed) {
    return null;
  }

  const shifted = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + Math.trunc(days)),
  );

  if (shifted < MIN_GREGORIAN || shifted > MAX_GREGORIAN) {
    return null;
  }

  const result: ParsedDate = {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };

  return {
    encoded: encodeDate(result, format),
    weekday: weekdayForDate(result),
  };
}

function actualDaysBetween(start: ParsedDate, end: ParsedDate): number {
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtc - startUtc) / 86_400_000);
}

/** US 30/360 day basis used by the ΔDYS alternate display. */
export function days360Between(start: ParsedDate, end: ParsedDate): number {
  let d1 = start.day;
  let d2 = end.day;
  const m1 = start.month;
  const m2 = end.month;
  const y1 = start.year;
  const y2 = end.year;

  if (d1 === 31) {
    d1 = 30;
  }

  if (d2 === 31 && (d1 === 30 || d1 === 31)) {
    d2 = 30;
  }

  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

export function daysBetweenDates(
  earlierEncoded: number,
  laterEncoded: number,
  format: DateFormat,
): DaysBetweenResult | null {
  const earlier = parseEncodedDate(earlierEncoded, format);
  const later = parseEncodedDate(laterEncoded, format);

  if (!earlier || !later) {
    return null;
  }

  const actual = actualDaysBetween(earlier, later);
  const days360 = days360Between(earlier, later);

  return { actual, days360 };
}
