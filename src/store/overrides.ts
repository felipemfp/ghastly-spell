import type { Channel, Match } from "../model";

export interface Override {
  channels: Channel[];
  scrapedSnapshot: string; // JSON of matches.channels when the fix was made
  confirmations: number;
}

export interface Effective {
  channels: Channel[];
  source: "scraper" | "crowd";
  confirmations: number;
}

const snapshot = (channels: Channel[]) => JSON.stringify(channels);
const sameNames = (a: Channel[], b: Channel[]) =>
  a.length === b.length && a.every((c, i) => c.name.toLowerCase() === b[i]!.name.toLowerCase());

// A crowd fix wins only until the scraper reports something different from what it said at fix time.
export function effectiveChannels(match: Match, override: Override | null): Effective {
  if (override && override.scrapedSnapshot === snapshot(match.channels)) {
    return { channels: override.channels, source: "crowd", confirmations: override.confirmations };
  }
  return { channels: match.channels, source: "scraper", confirmations: 0 };
}

export async function getOverride(db: D1Database, matchId: string): Promise<Override | null> {
  const row = await db
    .prepare("SELECT channels, scraped_snapshot, confirmations FROM channel_overrides WHERE match_id = ?1")
    .bind(matchId)
    .first<{ channels: string; scraped_snapshot: string; confirmations: number }>();
  return row ? { channels: JSON.parse(row.channels), scrapedSnapshot: row.scraped_snapshot, confirmations: row.confirmations } : null;
}

// Same fix against the same scraped value counts as a confirmation; anything else starts over at 1.
export async function saveOverride(db: D1Database, match: Match, channels: Channel[], now: Date): Promise<number> {
  const current = await getOverride(db, match.id);
  const scraped = snapshot(match.channels);
  const confirmations =
    current && current.scrapedSnapshot === scraped && sameNames(current.channels, channels) ? current.confirmations + 1 : 1;
  const kept = confirmations > 1 ? current!.channels : channels; // keep the first spelling
  await db
    .prepare(
      `INSERT INTO channel_overrides (match_id, channels, scraped_snapshot, confirmations, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (match_id) DO UPDATE SET channels = excluded.channels, scraped_snapshot = excluded.scraped_snapshot,
         confirmations = excluded.confirmations, updated_at = excluded.updated_at`,
    )
    .bind(match.id, JSON.stringify(kept), scraped, confirmations, now.toISOString())
    .run();
  return confirmations;
}
