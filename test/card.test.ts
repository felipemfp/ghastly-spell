import { describe, expect, it } from "vitest";
import { buildCard } from "../src/card";
import type { Match } from "../src/model";
import { findTeam } from "../src/teams";

const flamengo = findTeam("flamengo")!;
const match: Match = {
  id: "flamengo-gremio-brasileirao-serie-a-2026-11-04",
  home: "Flamengo", away: "Grêmio", homeSlug: "flamengo", awaySlug: "gremio",
  competition: "Brasileirão Série A", kickoffDateBrt: "2026-11-04", kickoffUtc: "2026-11-04T22:30:00.000Z",
  channels: [{ name: "Premiere", status: "confirmed" }],
};
const scraper = (m: Match) => ({ channels: m.channels, source: "scraper" as const, confirmations: 0 });

describe("buildCard", () => {
  it("puts teams and BRT kickoff in the title, competition and channels in the description", () => {
    const card = buildCard(flamengo, match, scraper(match));
    expect(card.title).toBe("Flamengo x Grêmio · qua 04/11 19:30");
    expect(card.description).toBe("Brasileirão Série A · Premiere");
  });

  it("labels tentative channels and keeps CBF ones plain", () => {
    const m = { ...match, channels: [{ name: "Premiere", status: "tentative" as const }, { name: "Globo", status: "cbf" as const }] };
    expect(buildCard(flamengo, m, scraper(m)).description).toBe("Brasileirão Série A · Premiere (a confirmar), Globo");
  });

  it("says the channel is not out yet when there is none", () => {
    const m = { ...match, channels: [] };
    expect(buildCard(flamengo, m, scraper(m)).description).toBe("Brasileirão Série A · Canal ainda não divulgado");
  });

  it("shows the date and 'horário a confirmar' when the time is unknown", () => {
    const m = { ...match, kickoffUtc: null, kickoffDateBrt: "2026-11-28" };
    expect(buildCard(flamengo, m, scraper(m)).title).toBe("Flamengo x Grêmio · sáb 28/11, horário a confirmar");
  });

  it("credits friends for a crowd fix, singular and plural", () => {
    const crowd = (n: number) => ({ channels: [{ name: "CazéTV", status: "confirmed" as const }], source: "crowd" as const, confirmations: n });
    expect(buildCard(flamengo, match, crowd(1)).description).toBe("Brasileirão Série A · CazéTV · confirmado por 1 amigo");
    expect(buildCard(flamengo, match, crowd(3)).description).toBe("Brasileirão Série A · CazéTV · confirmado por 3 amigos");
  });

  it("has a no-match card", () => {
    const card = buildCard(flamengo, null, null);
    expect(card.title).toBe("Flamengo · Sem jogos marcados");
  });

  it("changes its version when the content changes, so previews refetch the image", () => {
    const a = buildCard(flamengo, match, scraper(match)).version;
    const m = { ...match, channels: [{ name: "Globo", status: "confirmed" as const }] };
    expect(buildCard(flamengo, m, scraper(m)).version).not.toBe(a);
    expect(buildCard(flamengo, match, scraper(match)).version).toBe(a);
  });
});
