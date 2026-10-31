import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { effectiveChannels } from "../src/store/overrides";
import type { Match } from "../src/model";
import { get, meta, NOW, PAGES, postForm, scrapeFixtures } from "./helpers";
import { runScrape } from "../src/scraper/run";

const GREMIO = "flamengo-gremio-brasileirao-serie-a-2026-11-04";
const fix = (channels: string, passcode = "test-pass") => postForm(`/flamengo/${GREMIO}/channel`, { channels, passcode });
const description = async () => meta(await (await get("/flamengo")).text(), "og:description");

describe("POST /:team/:matchId/channel", () => {
  it("saves a fix, redirects, and shows it on the card", async () => {
    await scrapeFixtures();
    const res = await fix("CazéTV, Globo");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/flamengo");
    expect(await description()).toBe("Brasileirão Série A · CazéTV, Globo · confirmado por 1 amigo");
  });

  it("counts confirmations of the same fix, case and spacing aside", async () => {
    await scrapeFixtures();
    await fix("CazéTV");
    await fix(" cazétv ");
    expect(await description()).toBe("Brasileirão Série A · CazéTV · confirmado por 2 amigos");
    await fix("Globo"); // a different fix starts over
    expect(await description()).toBe("Brasileirão Série A · Globo · confirmado por 1 amigo");
  });

  it("rejects a wrong passcode", async () => {
    await scrapeFixtures();
    expect((await fix("Globo", "nope")).status).toBe(403);
    expect(await description()).toBe("Brasileirão Série A · Premiere");
  });

  it("404s an unknown match or a match of another team", async () => {
    await scrapeFixtures();
    expect((await postForm("/flamengo/nope/channel", { channels: "Globo", passcode: "test-pass" })).status).toBe(404);
    expect((await postForm(`/vasco/${GREMIO}/channel`, { channels: "Globo", passcode: "test-pass" })).status).toBe(404);
  });

  it("rejects empty, too many or too long channel lists", async () => {
    await scrapeFixtures();
    expect((await fix(" , ")).status).toBe(400);
    expect((await fix("a,b,c,d,e,f")).status).toBe(400);
    expect((await fix("x".repeat(41))).status).toBe(400);
  });

  it("gives the scraper back the last word once its value changes", async () => {
    await scrapeFixtures();
    await fix("CazéTV");
    await scrapeFixtures(); // same scraped value: the fix still stands
    expect(await description()).toContain("CazéTV");
    const changed = (team: string) =>
      Promise.resolve(team === "flamengo" ? PAGES.flamengo!.replace(">Premiere</span>", ">Globo</span>") : PAGES[team]!);
    await runScrape(env.DB, NOW, changed);
    expect(await description()).toBe("Brasileirão Série A · Globo");
  });

  it("logs override.saved", async () => {
    await scrapeFixtures();
    const log = vi.spyOn(console, "log");
    await fix("CazéTV");
    expect(log.mock.calls.map(([l]) => JSON.parse(String(l)))).toContainEqual({
      event: "override.saved", level: "info", match_id: GREMIO, confirmations: 1,
    });
    log.mockRestore();
  });
});

describe("effectiveChannels", () => {
  const match = { channels: [{ name: "Premiere", status: "confirmed" }] } as Match;
  it("uses the scraper when there is no override", () => {
    expect(effectiveChannels(match, null).source).toBe("scraper");
  });
  it("uses the override only while the snapshot matches", () => {
    const override = { channels: [{ name: "Globo", status: "confirmed" as const }], scrapedSnapshot: JSON.stringify(match.channels), confirmations: 2 };
    expect(effectiveChannels(match, override)).toEqual({ channels: override.channels, source: "crowd", confirmations: 2 });
    expect(effectiveChannels(match, { ...override, scrapedSnapshot: "[]" }).source).toBe("scraper");
  });
});
