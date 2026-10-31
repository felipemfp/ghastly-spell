// Regression tests for the cold critic's findings (2026-10-31).
import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { parseHtml, text } from "../src/scraper/html";
import { runScrape } from "../src/scraper/run";
import { parseSportune } from "../src/scraper/sportune";
import { nextMatch, upcomingMatches } from "../src/store/matches";
import { handle } from "../src/index";
import { get, NOW, PAGES, postForm, scrapeFixtures } from "./helpers";

const table = (game: string, channel = "<span><span>Premiere</span><span>Assinatura</span></span>") =>
  `<table><tr><th>Data</th><th>Hora (BRT)</th><th>Jogo</th><th>Competição / fase</th><th>Onde assistir</th></tr>
   <tr id="jogo-1"><td>quarta 04/11</td><td>19:30</td><td>${game}</td><td>Brasileirão Série A</td>
   <td><span aria-hidden="true">Onde assistir</span>${channel}</td></tr></table>`;

describe("ics escaping", () => {
  it("escapes semicolons in text values", async () => {
    await scrapeFixtures();
    const gremio = "flamengo-gremio-brasileirao-serie-a-2026-11-04";
    await postForm(`/flamengo/${gremio}/channel`, { channels: "Globo;SporTV", passcode: "test-pass" });
    const body = await (await get("/flamengo.ics")).text();
    const backslash = String.fromCharCode(92); // spelled out so the expectation can't share the source's escaping mistake
    expect(body).toContain(`SUMMARY:Flamengo x Grêmio (Globo${backslash};SporTV)`);
  });

  it("escapes backslashes, commas and newlines", async () => {
    const { escText } = await import("../src/web/ics");
    const b = String.fromCharCode(92);
    const codes = (s: string) => [...s].map((c) => c.charCodeAt(0));
    expect(codes(escText(`a${b}b,c\nd`))).toEqual(codes(`a${b}${b}b${b},c${b}nd`));
  });
});

describe("html decoding", () => {
  it("leaves out-of-range numeric entities alone instead of throwing", () => {
    expect(text(parseHtml("a &#99999999; b &#xZZ; c"))).toBe("a &#99999999; b &#xZZ; c");
  });
  it("decodes &times;", () => {
    expect(text(parseHtml("A &times; B"))).toBe("A × B");
  });
  it("treats script and style content as raw text", () => {
    const decoy = `<script>var t = "<table><tr><th>Onde assistir</th></tr></table>";</script><style>td{}</style>`;
    expect(parseSportune(decoy + table("Flamengo × Grêmio"))).toHaveLength(1);
  });
});

describe("sportune row tolerance", () => {
  it("accepts an ASCII ' x ' or &times; between teams", () => {
    expect(parseSportune(table("Flamengo x Grêmio"))[0]).toMatchObject({ home: "Flamengo", away: "Grêmio" });
    expect(parseSportune(table("Flamengo &times; Grêmio"))[0]).toMatchObject({ home: "Flamengo", away: "Grêmio" });
  });
  it("reads a channel name wrapped in inline markup", () => {
    const wrapped = `<span><span><b>Premiere</b><!-- -->*</span><span>Assinatura</span></span>`;
    expect(parseSportune(table("Flamengo × Grêmio", wrapped))[0]!.channels).toEqual([{ name: "Premiere", status: "tentative" }]);
  });
  it("logs skipped rows", async () => {
    const log = vi.spyOn(console, "log");
    const broken = PAGES.flamengo!.replace("Flamengo</span><span> × ", "Flamengo</span><span> vs ");
    await runScrape(env.DB, NOW, async (team) => (team === "flamengo" ? broken : PAGES[team]!));
    const events = log.mock.calls.map(([l]) => JSON.parse(String(l)));
    expect(events).toContainEqual({ event: "scrape.row_skipped", level: "error", team: "flamengo", rows: 1 });
    log.mockRestore();
  });
});

describe("scrape failure isolation", () => {
  it("does not count a shared match missing when the other team's fetch failed", async () => {
    // Flamengo x Vasco listed only on Flamengo's page; Flamengo's fetch then fails twice.
    const derby = table("Flamengo × Vasco da Gama").replace("04/11", "15/11");
    await runScrape(env.DB, NOW, async (team) => (team === "flamengo" ? derby : PAGES[team]!));
    const flamengoDown = (team: string) => (team === "flamengo" ? Promise.reject(new Error("503")) : Promise.resolve(PAGES[team]!));
    await runScrape(env.DB, NOW, flamengoDown);
    await runScrape(env.DB, NOW, flamengoDown);
    expect((await upcomingMatches(env.DB, "vasco", NOW, 60)).map((m) => m.id)).toContain("flamengo-vasco-brasileirao-serie-a-2026-11-15");
  });
  it("one empty team page does not stop the others", async () => {
    await runScrape(env.DB, NOW, async (team) => (team === "vasco" ? "<html></html>" : PAGES[team]!));
    expect(await nextMatch(env.DB, "flamengo", NOW)).not.toBeNull();
    expect(await nextMatch(env.DB, "vasco", NOW)).toBeNull();
  });
});

describe("request edge cases", () => {
  it("404s a malformed percent-escape in the match id", async () => {
    expect((await postForm("/flamengo/%E0/channel", { channels: "Globo", passcode: "test-pass" })).status).toBe(404);
  });
  it("400s a POST that is not a form", async () => {
    const res = await get("/flamengo/x/channel", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(res.status).toBe(400);
  });
  it("answers HEAD like GET without a body", async () => {
    await scrapeFixtures();
    const res = await get("/flamengo", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });
  it("refuses every override when the passcode secret is unset or empty", async () => {
    await scrapeFixtures();
    const req = () => new Request("https://ondepassa.test/flamengo/flamengo-gremio-brasileirao-serie-a-2026-11-04/channel", {
      method: "POST", body: new URLSearchParams({ channels: "Globo", passcode: "" }),
    });
    expect((await handle(req(), { ...env, OVERRIDE_PASSCODE: "" }, NOW)).status).toBe(403);
    expect((await handle(req(), { DB: env.DB } as typeof env, NOW)).status).toBe(403);
  });
});
