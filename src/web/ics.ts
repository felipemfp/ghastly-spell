import type { Match } from "../model";
import type { Effective } from "../store/overrides";
import type { Team } from "../teams";

const MATCH_MS = 2 * 3600_000;

// RFC 5545 3.3.11: backslash, semicolon and comma get a backslash; newlines become \n.
export const escText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
const utcStamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20261104T223000Z
const dateStamp = (date: string) => date.replace(/-/g, "");

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

function summaryChannels(e: Effective): string {
  if (e.channels.length === 0) return "canal a confirmar";
  return e.channels.map((c) => (c.status === "tentative" ? `${c.name} a confirmar` : c.name)).join(", ");
}

// RFC 5545 3.1: lines longer than 75 octets are folded with CRLF + space, never splitting a UTF-8 character.
export function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (size + n > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function renderIcs(team: Team, host: string, matches: { match: Match; effective: Effective }[], now: Date): string {
  const stamp = utcStamp(now.toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Onde Passa//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escText(`${team.name} · Onde Passa`)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
  ];
  for (const { match, effective } of matches) {
    lines.push("BEGIN:VEVENT", `UID:${match.id}@${host}`, `DTSTAMP:${stamp}`);
    if (match.kickoffUtc) {
      lines.push(`DTSTART:${utcStamp(match.kickoffUtc)}`, `DTEND:${utcStamp(new Date(Date.parse(match.kickoffUtc) + MATCH_MS).toISOString())}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(match.kickoffDateBrt)}`, `DTEND;VALUE=DATE:${dateStamp(nextDay(match.kickoffDateBrt))}`);
    }
    lines.push(
      `SUMMARY:${escText(`${match.home} x ${match.away} (${summaryChannels(effective)})`)}`,
      `DESCRIPTION:${escText(`${match.competition}\nOnde assistir: ${summaryChannels(effective)}\nhttps://${host}/${team.slug}`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
