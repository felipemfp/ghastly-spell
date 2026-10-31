import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import type { Match } from "../src/model";
import { runScrape } from "../src/scraper/run";
import { getMatch, nextMatch, upcomingMatches } from "../src/store/matches";
import flamengo from "./fixtures/sportune/flamengo.html?raw";
import saoPaulo from "./fixtures/sportune/sao-paulo.html?raw";
import vasco from "./fixtures/sportune/vasco.html?raw";
import { NOW } from "./helpers";

const pages: Record<string, string> = { flamengo, vasco, "sao-paulo": saoPaulo };
const fromFixtures = async (team: string) => pages[team]!;

describe("runScrape", () => {
  it("stores the upcoming matches for all teams", async () => {
    const result = await runScrape(env.DB, NOW, fromFixtures);
    expect(result.teamsOk).toEqual(["flamengo", "vasco", "sao-paulo"]);
    const next = await nextMatch(env.DB, "flamengo", NOW);
    expect(next?.id).toBe("flamengo-gremio-brasileirao-serie-a-2026-11-04");
    expect(next?.kickoffUtc).toBe("2026-11-04T22:30:00.000Z");
    expect(await upcomingMatches(env.DB, "vasco", NOW, 60)).toHaveLength(7);
  });

  it("is idempotent apart from last_seen_at", async () => {
    await runScrape(env.DB, NOW, fromFixtures);
    const before = await env.DB.prepare("SELECT id, channels, kickoff_utc, first_seen_at FROM matches ORDER BY id").all();
    await runScrape(env.DB, new Date(NOW.getTime() + 4 * 3600_000), fromFixtures);
    const after = await env.DB.prepare("SELECT id, channels, kickoff_utc, first_seen_at FROM matches ORDER BY id").all();
    expect(after.results).toEqual(before.results);
  });

  it("hides a match missing from two runs", async () => {
    await runScrape(env.DB, NOW, fromFixtures);
    const withoutGremio = (team: string) =>
      Promise.resolve(team === "flamengo" ? flamengo.replace(/<tr role="row" id="jogo-621".*?<\/tr>/s, "") : pages[team]!);
    await runScrape(env.DB, NOW, withoutGremio);
    expect((await nextMatch(env.DB, "flamengo", NOW))?.id).toContain("gremio");
    await runScrape(env.DB, NOW, withoutGremio);
    expect((await nextMatch(env.DB, "flamengo", NOW))?.id).toBe(
      "flamengo-athletico-paranaense-brasileirao-serie-a-2026-11-18",
    );
  });

  it("writes nothing and logs scrape.empty when every page is empty", async () => {
    await runScrape(env.DB, NOW, fromFixtures);
    const log = vi.spyOn(console, "log");
    const result = await runScrape(env.DB, NOW, async () => "<html></html>");
    expect(result.teamsOk).toEqual([]);
    expect(log.mock.calls.some(([line]) => String(line).includes('"scrape.empty"'))).toBe(true);
    for (let i = 0; i < 3; i++) await runScrape(env.DB, NOW, async () => "<html></html>");
    expect((await nextMatch(env.DB, "flamengo", NOW))?.id).toContain("gremio");
    log.mockRestore();
  });

  it("does not mark a team's matches missing when its fetch fails", async () => {
    await runScrape(env.DB, NOW, fromFixtures);
    const failing = (team: string) => (team === "vasco" ? Promise.reject(new Error("503")) : fromFixtures(team));
    for (let i = 0; i < 3; i++) await runScrape(env.DB, NOW, failing);
    expect(await upcomingMatches(env.DB, "vasco", NOW, 60)).toHaveLength(7);
  });
});

describe("nextMatch", () => {
  const base: Omit<Match, "id" | "kickoffUtc" | "kickoffDateBrt"> = {
    home: "Flamengo", away: "Grêmio", homeSlug: "flamengo", awaySlug: "gremio",
    competition: "Brasileirão Série A", channels: [],
  };
  async function insert(m: Match) {
    const { upsertMatches } = await import("../src/store/matches");
    await upsertMatches(env.DB, [m], NOW);
  }

  it("keeps showing a match for 2h after kickoff", async () => {
    await insert({ ...base, id: "live", kickoffDateBrt: "2026-10-31", kickoffUtc: "2026-10-31T15:00:00.000Z" });
    await insert({ ...base, id: "later", kickoffDateBrt: "2026-11-04", kickoffUtc: "2026-11-04T22:30:00.000Z" });
    expect((await nextMatch(env.DB, "flamengo", NOW))?.id).toBe("live"); // 1h after kickoff
    expect((await nextMatch(env.DB, "flamengo", new Date("2026-10-31T17:01:00Z")))?.id).toBe("later");
  });

  it("returns an unscheduled-time match on or after today in BRT", async () => {
    await insert({ ...base, id: "tbd", kickoffDateBrt: "2026-11-01", kickoffUtc: null });
    expect((await nextMatch(env.DB, "flamengo", NOW))?.id).toBe("tbd");
    expect(await nextMatch(env.DB, "flamengo", new Date("2026-11-02T12:00:00Z"))).toBeNull();
  });

  it("finds the team as away side too, and returns null for other teams", async () => {
    await insert({ ...base, id: "away", homeSlug: "palmeiras", awaySlug: "flamengo", kickoffDateBrt: "2026-11-21", kickoffUtc: "2026-11-21T19:30:00.000Z" });
    expect((await getMatch(env.DB, "away"))?.awaySlug).toBe("flamengo");
    expect((await nextMatch(env.DB, "flamengo", NOW))?.id).toBe("away");
    expect(await nextMatch(env.DB, "vasco", NOW)).toBeNull();
  });
});
