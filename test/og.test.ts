import { describe, expect, it, vi } from "vitest";
import { buildCard } from "../src/card";
import { findTeam } from "../src/teams";
import { ogHtml } from "../src/web/og";
import { get, scrapeFixtures } from "./helpers";

describe("GET /:team/og.png", () => {
  it("returns a cached PNG and logs its size", async () => {
    await scrapeFixtures();
    const log = vi.spyOn(console, "log");
    const res = await get("/flamengo/og.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG signature from the test renderer
    const entry = log.mock.calls.map(([l]) => JSON.parse(String(l))).find((e) => e.event === "og.render");
    expect(entry).toEqual({ event: "og.render", level: "info", team: "flamengo", bytes: bytes.length });
    log.mockRestore();
  });

  it("puts the card text in the image template, escaped", () => {
    const card = buildCard(findTeam("sao-paulo")!, {
      id: "x", home: "São Paulo", away: "A & B", homeSlug: "sao-paulo", awaySlug: "a-b", competition: "Brasileirão Série A",
      kickoffDateBrt: "2026-11-04", kickoffUtc: "2026-11-05T00:30:00.000Z", channels: [{ name: "Globo", status: "confirmed" }],
    }, { channels: [{ name: "Globo", status: "confirmed" }], source: "scraper", confirmations: 0 });
    const html = ogHtml(card);
    expect(html).toContain("São Paulo x A &amp; B");
    expect(html).toContain("qua 04/11 21:30");
    expect(html).toContain("Globo");
  });
});
