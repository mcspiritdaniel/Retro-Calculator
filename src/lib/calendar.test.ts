import { describe, expect, it } from "vitest";
import {
  addDaysToDate,
  daysBetweenDates,
  encodeDate,
  formatCalendarDate,
  parseEncodedDate,
  weekdayForDate,
} from "./calendar";

describe("calendar", () => {
  it("parses and encodes month-day-year dates", () => {
    expect(parseEncodedDate(4.072004, "mdy")).toEqual({
      year: 2004,
      month: 4,
      day: 7,
    });
    expect(encodeDate({ year: 2004, month: 4, day: 7 }, "mdy")).toBe(4.072004);
  });

  it("parses and encodes day-month-year dates", () => {
    expect(parseEncodedDate(14.052004, "dmy")).toEqual({
      year: 2004,
      month: 5,
      day: 14,
    });
    expect(encodeDate({ year: 2004, month: 5, day: 14 }, "dmy")).toBe(
      14.052004,
    );
  });

  it("adds days for the option expiration example", () => {
    const result = addDaysToDate(14.052004, 120, "dmy");

    expect(result?.encoded).toBeCloseTo(11.092004, 6);
    expect(result?.weekday).toBe(6);
    expect(formatCalendarDate(result!.encoded, result!.weekday, "dmy")).toBe(
      "11.09.2004 6",
    );
  });

  it("computes actual and 30/360 days between dates", () => {
    const result = daysBetweenDates(6.032004, 10.142005, "mdy");

    expect(result?.actual).toBe(498);
    expect(result?.days360).toBe(491);
  });

  it("reports Monday as 1 and Sunday as 7", () => {
    expect(weekdayForDate({ year: 2004, month: 9, day: 11 })).toBe(6);
    expect(weekdayForDate({ year: 2004, month: 9, day: 13 })).toBe(1);
  });
});
