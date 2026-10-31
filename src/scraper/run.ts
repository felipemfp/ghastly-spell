import { log } from "../log";
import type { Match } from "../model";
import { markMissing, upsertMatches } from "../store/matches";
import { TEAMS } from "../teams";
import type { FetchPage } from "./adapter";
import { normalize } from "./normalize";
import { parseSportunePage } from "./sportune";

export interface ScrapeResult {
  teamsOk: string[];
  matches: number;
}

export async function runScrape(db: D1Database, now: Date, fetchPage: FetchPage): Promise<ScrapeResult> {
  const started = Date.now();
  const teamsOk: string[] = [];
  const byId = new Map<string, Match>();

  // Sequential on purpose: three polite requests per run.
  for (const team of TEAMS) {
    try {
      const { listings, skipped } = parseSportunePage(await fetchPage(team.slug));
      if (skipped > 0) log("scrape.row_skipped", { team: team.slug, rows: skipped }, "error");
      if (listings.length === 0) {
        // Could be a markup change or an outage page. Treat as failed, never as "no matches".
        log("scrape.empty", { team: team.slug }, "error");
        continue;
      }
      for (const raw of listings) {
        const match = normalize(raw, now);
        if (match) byId.set(match.id, match);
      }
      teamsOk.push(team.slug);
    } catch (err) {
      log("scrape.error", { team: team.slug, message: String(err) }, "error");
    }
  }

  const matches = [...byId.values()];
  await upsertMatches(db, matches, now);
  await markMissing(db, teamsOk, TEAMS.map((t) => t.slug), [...byId.keys()], now);
  log("scrape.done", {
    teams_ok: teamsOk,
    matches_upserted: matches.length,
    missing_channels: matches.filter((m) => m.channels.length === 0).length,
    duration_ms: Date.now() - started,
  });
  return { teamsOk, matches: matches.length };
}
