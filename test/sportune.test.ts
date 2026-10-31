import { describe, expect, it } from "vitest";
import { parseSportune } from "../src/scraper/sportune";
import flamengo from "./fixtures/sportune/flamengo.html?raw";
import saoPaulo from "./fixtures/sportune/sao-paulo.html?raw";
import vasco from "./fixtures/sportune/vasco.html?raw";

describe("parseSportune", () => {
  it("reads only the upcoming table", () => {
    const rows = parseSportune(flamengo);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.date)).toEqual(["04/11", "18/11", "21/11", "28/11", "02/12"]);
  });

  it("parses a confirmed single-channel row", () => {
    expect(parseSportune(flamengo)[0]).toEqual({
      date: "04/11",
      time: "19:30",
      home: "Flamengo",
      away: "Grêmio",
      competition: "Brasileirão Série A",
      channels: [{ name: "Premiere", status: "confirmed" }],
    });
  });

  it("marks * channels as tentative", () => {
    expect(parseSportune(flamengo)[1]!.channels).toEqual([{ name: "Premiere", status: "tentative" }]);
  });

  it("marks CBF-announced channels", () => {
    expect(parseSportune(flamengo)[2]!.channels).toEqual([
      { name: "ge tv", status: "cbf" },
      { name: "Globo", status: "cbf" },
      { name: "Premiere", status: "cbf" },
    ]);
  });

  it("returns a null time when it is 'a confirmar'", () => {
    expect(parseSportune(flamengo)[3]!.time).toBeNull();
  });

  it("keeps competition phases and mixes of statuses", () => {
    const rows = parseSportune(vasco);
    expect(rows).toHaveLength(7);
    expect(rows[0]!.competition).toBe("Copa do Brasil · Jogo de ida");
    expect(rows[0]!.home).toBe("Palmeiras");
    expect(rows[0]!.away).toBe("Vasco da Gama");
    expect(rows[2]!.channels.map((c) => `${c.name}:${c.status}`)).toEqual([
      "ge tv:confirmed",
      "Prime Video:confirmed",
      "Globo:cbf",
      "Premiere:cbf",
      "SporTV:cbf",
    ]);
  });

  it("parses the São Paulo page", () => {
    const first = parseSportune(saoPaulo)[0]!;
    expect(first).toMatchObject({ date: "04/11", time: "21:30", home: "São Paulo", away: "Corinthians" });
  });

  it("returns [] for a page without an upcoming table", () => {
    expect(parseSportune("<html><body><p>Fora do ar</p></body></html>")).toEqual([]);
    const pastOnly = flamengo.slice(flamengo.indexOf("</table>") + "</table>".length);
    expect(parseSportune(pastOnly)).toEqual([]);
  });
});
