import { env } from "cloudflare:test";
import { handle } from "../src/index";
import { runScrape } from "../src/scraper/run";
import flamengo from "./fixtures/sportune/flamengo.html?raw";
import saoPaulo from "./fixtures/sportune/sao-paulo.html?raw";
import vasco from "./fixtures/sportune/vasco.html?raw";

export const NOW = new Date("2026-10-31T16:00:00Z"); // fixtures were captured that day

export const PAGES: Record<string, string> = { flamengo, vasco, "sao-paulo": saoPaulo };

export const scrapeFixtures = (now = NOW) => runScrape(env.DB, now, async (team) => PAGES[team]!);

// A real PNG signature, so the route's headers and logging are tested without fetching fonts.
const fakePng = async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function get(path: string, init?: RequestInit, now = NOW): Promise<Response> {
  return handle(new Request(`https://ondepassa.test${path}`, init), env, now, fakePng);
}

export function postForm(path: string, fields: Record<string, string>, now = NOW): Promise<Response> {
  return get(path, { method: "POST", body: new URLSearchParams(fields), redirect: "manual" }, now);
}

export function meta(html: string, property: string): string | undefined {
  const m = html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`));
  return m?.[1]?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'");
}

// Follows /:team -> /:team/:share-slug the way a browser does, and returns the card page.
export async function page(team: string, now = NOW): Promise<Response> {
  const res = await get(`/${team}`, { redirect: "manual" }, now);
  const location = res.headers.get("location");
  if (res.status !== 302 || !location) throw new Error(`expected a 302 from /${team}, got ${res.status}`);
  return get(location, undefined, now);
}
