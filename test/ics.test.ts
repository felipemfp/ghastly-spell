import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { get, scrapeFixtures } from "./helpers";

async function feed(team: string) {
  const res = await get(`/${team}.ics`);
  return { res, body: await res.text() };
}

describe("GET /:team.ics", () => {
  it("parses as a calendar with one event per upcoming match", async () => {
    await scrapeFixtures();
    const { res, body } = await feed("flamengo");
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=1800");
    const events = new ICAL.Component(ICAL.parse(body)).getAllSubcomponents("vevent").map((v) => new ICAL.Event(v));
    expect(events).toHaveLength(5);
    const first = events[0]!;
    expect(first.uid).toBe("flamengo-gremio-brasileirao-serie-a-2026-11-04@ondepassa.test");
    expect(first.summary).toBe("Flamengo x Grêmio (Premiere)");
    expect(first.startDate.toJSDate().toISOString()).toBe("2026-11-04T22:30:00.000Z");
    expect(first.endDate.toJSDate().toISOString()).toBe("2026-11-05T00:30:00.000Z");
  });

  it("makes unknown-time matches all-day events", async () => {
    await scrapeFixtures();
    const { body } = await feed("flamengo");
    const events = new ICAL.Component(ICAL.parse(body)).getAllSubcomponents("vevent").map((v) => new ICAL.Event(v));
    const tbd = events.find((e) => e.uid.startsWith("coritiba-flamengo"))!;
    expect(tbd.startDate.isDate).toBe(true);
    expect(tbd.startDate.toString()).toBe("2026-11-28");
    expect(tbd.summary).toBe("Coritiba x Flamengo (Premiere a confirmar)");
  });

  it("uses CRLF and folds lines at 75 octets", async () => {
    await scrapeFixtures();
    const { body } = await feed("vasco");
    expect(body.split("\r\n").join("")).not.toContain("\n");
    const encoder = new TextEncoder();
    for (const line of body.split("\r\n")) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    expect(body).toContain("Globoplay"); // the long 6-channel line survived folding
  });

  it("escapes commas in text values", async () => {
    await scrapeFixtures();
    const { body } = await feed("vasco");
    expect(body).toMatch(/SUMMARY:Palmeiras x Vasco da Gama \(Globo\\, Premiere/);
  });
});
