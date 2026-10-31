import { describe, expect, it } from "vitest";
import { formatCardDate, formatCardDateTime, inferYear, todayBrt, toUtc } from "../src/time";

describe("toUtc", () => {
  it("converts BRT to UTC", () => {
    expect(toUtc("2026-11-04", "19:30")).toBe("2026-11-04T22:30:00.000Z");
  });
  it("crosses midnight UTC for late games", () => {
    expect(toUtc("2026-11-04", "21:30")).toBe("2026-11-05T00:30:00.000Z");
  });
});

describe("inferYear", () => {
  it("uses the current year for a near date", () => {
    expect(inferYear(4, 11, new Date("2026-10-31T16:00:00Z"))).toBe(2026);
  });
  it("rolls forward in December for January dates", () => {
    expect(inferYear(5, 1, new Date("2026-12-20T16:00:00Z"))).toBe(2027);
  });
  it("rolls back in January for a recent December date", () => {
    expect(inferYear(20, 12, new Date("2027-01-05T16:00:00Z"))).toBe(2026);
  });
  it("judges 'today' in BRT, not UTC", () => {
    // 01:00Z on Jan 1 is still Dec 31 in Brasília, so 31/12 is today, not almost a year ago.
    expect(inferYear(31, 12, new Date("2027-01-01T01:00:00Z"))).toBe(2026);
  });
});

describe("todayBrt", () => {
  it("is the Brasília calendar date", () => {
    expect(todayBrt(new Date("2026-11-05T02:00:00Z"))).toBe("2026-11-04");
  });
});

describe("formatting", () => {
  it("formats a kickoff as weekday, day/month and time in BRT", () => {
    expect(formatCardDateTime("2026-11-04T22:30:00.000Z")).toBe("qua 04/11 19:30");
    expect(formatCardDateTime("2026-11-05T00:30:00.000Z")).toBe("qua 04/11 21:30");
  });
  it("formats a date-only kickoff", () => {
    expect(formatCardDate("2026-11-28")).toBe("sáb 28/11");
  });
});
