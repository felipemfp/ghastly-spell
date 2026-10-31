import type { Channel } from "../model";

// One row of a listing site, as raw as possible: no year inference, no timezone math.
export interface RawListing {
  date: string; // "04/11"
  time: string | null; // "19:30", null when not set yet
  home: string;
  away: string;
  competition: string;
  channels: Channel[];
}

// Returns the HTML of one team's page. Injected so tests run from fixtures.
export type FetchPage = (teamSlug: string) => Promise<string>;
