import { describe, expect, it } from "vitest";
import { normalize } from "../src/scraper/normalize";
import type { RawListing } from "../src/scraper/adapter";
import { NOW } from "./helpers";

const raw: RawListing = {
  date: "04/11",
  time: "21:30",
  home: "São Paulo",
  away: "Corinthians",
  competition: "Brasileirão Série A",
  channels: [{ name: "Globo", status: "confirmed" }],
};

describe("normalize", () => {
  it("builds a stable id and UTC kickoff", () => {
    expect(normalize(raw, NOW)).toEqual({
      id: "sao-paulo-corinthians-brasileirao-serie-a-2026-11-04",
      home: "São Paulo",
      away: "Corinthians",
      homeSlug: "sao-paulo",
      awaySlug: "corinthians",
      competition: "Brasileirão Série A",
      kickoffDateBrt: "2026-11-04",
      kickoffUtc: "2026-11-05T00:30:00.000Z",
      channels: [{ name: "Globo", status: "confirmed" }],
    });
  });

  it("maps team aliases to allowlist slugs", () => {
    const m = normalize({ ...raw, home: "Vasco da Gama" }, NOW)!;
    expect(m.homeSlug).toBe("vasco");
    expect(m.id).toBe("vasco-corinthians-brasileirao-serie-a-2026-11-04");
  });

  it("keeps a null kickoff when the time is unknown", () => {
    const m = normalize({ ...raw, time: null }, NOW)!;
    expect(m.kickoffUtc).toBeNull();
    expect(m.kickoffDateBrt).toBe("2026-11-04");
  });

  it("drops a row with an unreadable date", () => {
    expect(normalize({ ...raw, date: "??" }, NOW)).toBeNull();
  });
});
