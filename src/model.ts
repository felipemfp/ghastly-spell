export type ChannelStatus = "confirmed" | "cbf" | "tentative";

export interface Channel {
  name: string;
  status: ChannelStatus;
}

export interface Match {
  id: string;
  home: string;
  away: string;
  homeSlug: string;
  awaySlug: string;
  competition: string;
  kickoffDateBrt: string; // YYYY-MM-DD
  kickoffUtc: string | null; // ISO 8601 from Date#toISOString; null while the time is "a confirmar"
  channels: Channel[];
}
