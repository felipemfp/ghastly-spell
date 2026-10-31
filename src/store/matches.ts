import type { Match } from "../model";
import { todayBrt } from "../time";

interface MatchRow {
  id: string;
  home: string;
  away: string;
  home_slug: string;
  away_slug: string;
  competition: string;
  kickoff_date_brt: string;
  kickoff_utc: string | null;
  channels: string;
}

const LIVE_WINDOW_MS = 2 * 3600_000; // keep showing a match while it is being played
const HIDDEN_AFTER_MISSING_RUNS = 2;

const toMatch = (r: MatchRow): Match => ({
  id: r.id,
  home: r.home,
  away: r.away,
  homeSlug: r.home_slug,
  awaySlug: r.away_slug,
  competition: r.competition,
  kickoffDateBrt: r.kickoff_date_brt,
  kickoffUtc: r.kickoff_utc,
  channels: JSON.parse(r.channels),
});

export async function upsertMatches(db: D1Database, matches: Match[], now: Date): Promise<void> {
  if (matches.length === 0) return;
  const seenAt = now.toISOString();
  const stmt = db.prepare(
    `INSERT INTO matches (id, home, away, home_slug, away_slug, competition, kickoff_date_brt, kickoff_utc, channels, first_seen_at, last_seen_at, missing_runs)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, 0)
     ON CONFLICT (id) DO UPDATE SET
       home = excluded.home, away = excluded.away, competition = excluded.competition,
       kickoff_utc = excluded.kickoff_utc, channels = excluded.channels,
       last_seen_at = excluded.last_seen_at, missing_runs = 0`,
  );
  await db.batch(
    matches.map((m) =>
      stmt.bind(m.id, m.home, m.away, m.homeSlug, m.awaySlug, m.competition, m.kickoffDateBrt, m.kickoffUtc, JSON.stringify(m.channels), seenAt),
    ),
  );
}

// Future matches of teams that were scraped successfully but are not in this run: count a miss.
export async function markMissing(db: D1Database, teams: string[], seenIds: string[], now: Date): Promise<void> {
  if (teams.length === 0) return;
  await db
    .prepare(
      `UPDATE matches SET missing_runs = missing_runs + 1
       WHERE kickoff_date_brt >= ?1
         AND (home_slug IN (SELECT value FROM json_each(?2)) OR away_slug IN (SELECT value FROM json_each(?2)))
         AND id NOT IN (SELECT value FROM json_each(?3))`,
    )
    .bind(todayBrt(now), JSON.stringify(teams), JSON.stringify(seenIds))
    .run();
}

const VISIBLE_UPCOMING = `(home_slug = ?1 OR away_slug = ?1)
  AND missing_runs < ${HIDDEN_AFTER_MISSING_RUNS}
  AND ((kickoff_utc IS NOT NULL AND kickoff_utc > ?2) OR (kickoff_utc IS NULL AND kickoff_date_brt >= ?3))`;
const ORDER = "ORDER BY kickoff_date_brt, kickoff_utc IS NULL, kickoff_utc";

export async function nextMatch(db: D1Database, team: string, now: Date): Promise<Match | null> {
  const row = await db
    .prepare(`SELECT * FROM matches WHERE ${VISIBLE_UPCOMING} ${ORDER} LIMIT 1`)
    .bind(team, new Date(now.getTime() - LIVE_WINDOW_MS).toISOString(), todayBrt(now))
    .first<MatchRow>();
  return row ? toMatch(row) : null;
}

export async function upcomingMatches(db: D1Database, team: string, now: Date, days: number): Promise<Match[]> {
  const until = todayBrt(new Date(now.getTime() + days * 86_400_000));
  const { results } = await db
    .prepare(`SELECT * FROM matches WHERE ${VISIBLE_UPCOMING} AND kickoff_date_brt <= ?4 ${ORDER}`)
    .bind(team, new Date(now.getTime() - LIVE_WINDOW_MS).toISOString(), todayBrt(now), until)
    .all<MatchRow>();
  return results.map(toMatch);
}

export async function getMatch(db: D1Database, id: string): Promise<Match | null> {
  const row = await db.prepare("SELECT * FROM matches WHERE id = ?1").bind(id).first<MatchRow>();
  return row ? toMatch(row) : null;
}
