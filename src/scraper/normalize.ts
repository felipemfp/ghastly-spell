import type { Match } from "../model";
import { slugify, teamSlug } from "../teams";
import { inferYear, toUtc } from "../time";
import type { RawListing } from "./adapter";

export function normalize(raw: RawListing, now: Date): Match | null {
  const [day, month] = raw.date.split("/").map(Number);
  if (!day || !month) return null;
  const year = inferYear(day, month, now);
  const kickoffDateBrt = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const homeSlug = teamSlug(raw.home);
  const awaySlug = teamSlug(raw.away);
  return {
    // A rescheduled match gets a new id on purpose; the old row ages out via missing_runs.
    id: `${homeSlug}-${awaySlug}-${slugify(raw.competition)}-${kickoffDateBrt}`,
    home: raw.home,
    away: raw.away,
    homeSlug,
    awaySlug,
    competition: raw.competition,
    kickoffDateBrt,
    kickoffUtc: raw.time ? toUtc(kickoffDateBrt, raw.time) : null,
    channels: raw.channels,
  };
}
