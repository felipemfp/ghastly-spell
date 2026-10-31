import type { Channel, Match } from "./model";
import type { Effective } from "./store/overrides";
import { slugify, type Team } from "./teams";
import { formatCardDate, formatCardDateTime } from "./time";

// The text shared by the page, the OG tags, the OG image and the home page.
export interface Card {
  team: Team;
  match: Match | null;
  matchup: string; // "Flamengo x Grêmio"
  when: string; // "qua 04/11 19:30"
  title: string;
  competition: string;
  channelsText: string;
  credit: string; // "confirmado por 2 amigos" or ""
  description: string;
  version: string; // changes whenever the visible content changes
  shareSlug: string; // "qua-04-11-19-30-premiere": the URL people share, see shareSlugFor
}

const MAX_SLUG = 80;

// WhatsApp caches a link preview per exact URL, so the shared URL must change whenever the preview would:
// kickoff day, time and channels (with their "a confirmar" state). Crowd confirmation counts are left out.
function shareSlugFor(match: Match, channels: Channel[]): string {
  const when = match.kickoffUtc ? formatCardDateTime(match.kickoffUtc) : formatCardDate(match.kickoffDateBrt);
  const slug = slugify(`${when} ${channels.length ? channelsText(channels) : "sem canal"}`);
  if (slug.length <= MAX_SLUG) return slug;
  return slug.slice(0, MAX_SLUG).replace(/-[^-]*$/, "");
}

const channelLabel = (c: Channel) => (c.status === "tentative" ? `${c.name} (a confirmar)` : c.name);

export function channelsText(channels: Channel[]): string {
  return channels.length ? channels.map(channelLabel).join(", ") : "Canal ainda não divulgado";
}

export function buildCard(team: Team, match: Match | null, effective: Effective | null): Card {
  if (!match || !effective) {
    const title = `${team.name} · Sem jogos marcados`;
    const description = "Nenhum jogo marcado nas próximas semanas.";
    return { team, match: null, matchup: team.name, when: "", title, competition: "", channelsText: "", credit: "", description, version: hash(title), shareSlug: "sem-jogos" };
  }
  const matchup = `${match.home} x ${match.away}`;
  const when = match.kickoffUtc ? formatCardDateTime(match.kickoffUtc) : `${formatCardDate(match.kickoffDateBrt)}, horário a confirmar`;
  const text = channelsText(effective.channels);
  const n = effective.confirmations;
  const credit = effective.source === "crowd" ? `confirmado por ${n} ${n === 1 ? "amigo" : "amigos"}` : "";
  const title = `${matchup} · ${when}`;
  const description = [match.competition, text, credit].filter(Boolean).join(" · ");
  return {
    team, match, matchup, when, title, competition: match.competition, channelsText: text, credit, description,
    version: hash(title + description), shareSlug: shareSlugFor(match, effective.channels),
  };
}

// FNV-1a, enough to bust preview caches; not security.
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}
