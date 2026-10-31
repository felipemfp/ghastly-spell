import { log } from "../log";
import type { Channel } from "../model";
import { getMatch } from "../store/matches";
import { saveOverride } from "../store/overrides";
import type { Team } from "../teams";

const MAX_CHANNELS = 5;
const MAX_NAME = 40;

export function parseChannelInput(input: string): Channel[] | null {
  const names = input.split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (names.length === 0 || names.length > MAX_CHANNELS || names.some((n) => n.length > MAX_NAME)) return null;
  return names.map((name) => ({ name, status: "confirmed" }));
}

async function samePasscode(given: string, expected: string): Promise<boolean> {
  if (!expected) return false; // no secret configured: overrides are off
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([given, expected].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  return crypto.subtle.timingSafeEqual(a!, b!);
}

export async function handleOverride(request: Request, db: D1Database, passcode: string, team: Team, matchId: string, now: Date): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Envie o formulário da página.", { status: 400 });
  }
  if (!(await samePasscode(String(form.get("passcode") ?? ""), passcode))) {
    return new Response("Senha incorreta.", { status: 403 });
  }
  const match = await getMatch(db, matchId);
  if (!match || (match.homeSlug !== team.slug && match.awaySlug !== team.slug)) {
    return new Response("Jogo não encontrado.", { status: 404 });
  }
  const channels = parseChannelInput(String(form.get("channels") ?? ""));
  if (!channels) {
    return new Response(`Informe de 1 a ${MAX_CHANNELS} canais, separados por vírgula, com até ${MAX_NAME} letras cada.`, { status: 400 });
  }
  const confirmations = await saveOverride(db, match, channels, now);
  log("override.saved", { match_id: match.id, confirmations });
  return new Response(null, { status: 303, headers: { location: `/${team.slug}` } });
}
