// WhatsApp caches a link preview per exact URL (tested live on 2026-10-31: a reshare of /flamengo kept the old
// channel, /flamengo?r=1 showed the new one). So the shared URL must change whenever the preview text changes.
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { buildCard } from "../src/card";
import type { Match } from "../src/model";
import { runScrape } from "../src/scraper/run";
import { findTeam } from "../src/teams";
import { get, meta, NOW, page, PAGES, postForm, scrapeFixtures } from "./helpers";

const flamengo = findTeam("flamengo")!;
const match: Match = {
  id: "m", home: "Flamengo", away: "Grêmio", homeSlug: "flamengo", awaySlug: "gremio", competition: "Brasileirão Série A",
  kickoffDateBrt: "2026-11-04", kickoffUtc: "2026-11-04T22:30:00.000Z", channels: [{ name: "Premiere", status: "confirmed" }],
};
const slugOf = (m: Match) => buildCard(flamengo, m, { channels: m.channels, source: "scraper", confirmations: 0 }).shareSlug;

describe("shareSlug", () => {
  it("reads as the kickoff and the channels", () => {
    expect(slugOf(match)).toBe("qua-04-11-19-30-premiere");
  });
  it("changes when the channel is announced or confirmed", () => {
    expect(slugOf({ ...match, channels: [] })).toBe("qua-04-11-19-30-sem-canal");
    expect(slugOf({ ...match, channels: [{ name: "Premiere", status: "tentative" }] })).toBe("qua-04-11-19-30-premiere-a-confirmar");
    expect(slugOf({ ...match, channels: [{ name: "Globo", status: "cbf" }, { name: "Premiere", status: "cbf" }] })).toBe("qua-04-11-19-30-globo-premiere");
  });
  it("changes when the time gets set", () => {
    expect(slugOf({ ...match, kickoffUtc: null, kickoffDateBrt: "2026-11-28" })).toBe("sab-28-11-premiere");
  });
  it("stays short with many channels", () => {
    const many = ["Globo", "Premiere", "SporTV", "ge tv", "Prime Video", "Globoplay", "CazéTV", "Record"].map((name) => ({ name, status: "confirmed" as const }));
    const slug = slugOf({ ...match, channels: many });
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toMatch(/^[a-z0-9-]+[a-z0-9]$/);
  });
  it("is sem-jogos without a match", () => {
    expect(buildCard(flamengo, null, null).shareSlug).toBe("sem-jogos");
  });
});

describe("GET /:team", () => {
  it("redirects to the current share URL, uncached", async () => {
    await scrapeFixtures();
    const res = await get("/flamengo", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/flamengo/qua-04-11-19-30-premiere");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("moves to a new URL when a friend fixes the channel", async () => {
    await scrapeFixtures();
    await postForm("/flamengo/flamengo-gremio-brasileirao-serie-a-2026-11-04/channel", { channels: "CazéTV", passcode: "test-pass" });
    expect((await get("/flamengo", { redirect: "manual" })).headers.get("location")).toBe("/flamengo/qua-04-11-19-30-cazetv");
  });

  it("moves to a new URL when the scraper changes the channel", async () => {
    await scrapeFixtures();
    await runScrape(env.DB, NOW, async (team) => (team === "flamengo" ? PAGES.flamengo!.replace(">Premiere</span>", ">Globo</span>") : PAGES[team]!));
    expect((await get("/flamengo", { redirect: "manual" })).headers.get("location")).toBe("/flamengo/qua-04-11-19-30-globo");
  });
});

describe("GET /:team/:slug", () => {
  it("serves the current card on an old share URL, with og:url pointing at the current one", async () => {
    await scrapeFixtures();
    const res = await get("/flamengo/sab-01-01-12-00-old-channel");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(meta(html, "og:title")).toBe("Flamengo x Grêmio · qua 04/11 19:30");
    expect(meta(html, "og:url")).toBe("https://ondepassa.test/flamengo/qua-04-11-19-30-premiere");
  });

  it("offers the share URL on the page", async () => {
    await scrapeFixtures();
    const html = await (await page("flamengo")).text();
    expect(html).toContain('data-share-url="https://ondepassa.test/flamengo/qua-04-11-19-30-premiere"');
  });
});
