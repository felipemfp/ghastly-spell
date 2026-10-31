import { describe, expect, it, vi } from "vitest";
import { get, meta, page, scrapeFixtures } from "./helpers";

describe("GET /:team", () => {
  it("renders the next match in the OG tags", async () => {
    await scrapeFixtures();
    const res = await page("flamengo");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    const html = await res.text();
    expect(meta(html, "og:title")).toBe("Flamengo x Grêmio · qua 04/11 19:30");
    expect(meta(html, "og:description")).toBe("Brasileirão Série A · Premiere");
    expect(meta(html, "og:image")).toMatch(/^https:\/\/ondepassa\.test\/flamengo\/og\.png\?v=\w+$/);
    expect(meta(html, "og:url")).toBe("https://ondepassa.test/flamengo/qua-04-11-19-30-premiere");
    expect(meta(html, "twitter:card")).toBe("summary_large_image");
    expect(html).toContain('href="/flamengo.ics"');
  });

  it("shows São Paulo's late game in BRT, not UTC", async () => {
    await scrapeFixtures();
    expect(meta(await (await page("sao-paulo")).text(), "og:title")).toBe("São Paulo x Corinthians · qua 04/11 21:30");
  });

  it("says there are no matches when the store is empty", async () => {
    expect(meta(await (await page("vasco")).text(), "og:title")).toBe("Vasco · Sem jogos marcados");
  });

  it("escapes text from the scraped site", async () => {
    const { upsertMatches } = await import("../src/store/matches");
    const { env } = await import("cloudflare:test");
    await upsertMatches(env.DB, [{
      id: "x", home: "Flamengo", away: '<script>alert("x")</script>', homeSlug: "flamengo", awaySlug: "x",
      competition: "A & B", kickoffDateBrt: "2026-11-04", kickoffUtc: "2026-11-04T22:30:00.000Z", channels: [],
    }], new Date("2026-10-31T16:00:00Z"));
    const html = await (await page("flamengo")).text();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("logs page.view", async () => {
    const log = vi.spyOn(console, "log");
    await page("flamengo");
    expect(log.mock.calls.map(([l]) => JSON.parse(String(l)))).toContainEqual({ event: "page.view", level: "info", team: "flamengo", slug: "sem-jogos", current: true });
    log.mockRestore();
  });
});
