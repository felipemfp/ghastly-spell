import { buildCard, type Card } from "./card";
import type { Env } from "./env";
import { log } from "./log";
import { runScrape } from "./scraper/run";
import { fetchSportune } from "./scraper/sportune";
import { nextMatch, upcomingMatches } from "./store/matches";
import { effectiveChannels, getOverride } from "./store/overrides";
import { findTeam, type Team, TEAMS } from "./teams";
import { renderHome, renderNotFound } from "./web/home";
import { renderIcs } from "./web/ics";
import { renderOg, type RenderPng, renderWithWorkersOg } from "./web/og";
import { handleOverride } from "./web/override";
import { renderTeamPage } from "./web/page";

async function cardFor(db: D1Database, team: Team, now: Date): Promise<Card> {
  const match = await nextMatch(db, team.slug, now);
  const effective = match ? effectiveChannels(match, await getOverride(db, match.id)) : null;
  return buildCard(team, match, effective);
}

// `now` and the PNG renderer are parameters so tests can pin the clock and skip the network font fetch.
export async function handle(request: Request, env: Env, now: Date, renderPng: RenderPng = renderWithWorkersOg): Promise<Response> {
  // Some link unfurlers probe with HEAD first: answer it as GET without a body.
  if (request.method === "HEAD") {
    const res = await handle(new Request(request.url, { method: "GET", headers: request.headers }), env, now, renderPng);
    return new Response(null, { status: res.status, headers: res.headers });
  }
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/health") return new Response("ok");

  if (request.method === "GET" && path === "/") {
    return renderHome(await Promise.all(TEAMS.map((t) => cardFor(env.DB, t, now))));
  }

  const ics = path.match(/^\/([a-z0-9-]+)\.ics$/);
  const bare = path.match(/^\/([a-z0-9-]+)\/?$/);
  const og = path.match(/^\/([a-z0-9-]+)\/og\.png$/);
  const card = path.match(/^\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
  const override = path.match(/^\/([a-z0-9-]+)\/([^/]+)\/channel$/);
  const team = findTeam((ics ?? bare ?? og ?? card ?? override)?.[1] ?? "");
  if (!team) return renderNotFound();

  if (request.method === "POST" && override) {
    let matchId: string;
    try {
      matchId = decodeURIComponent(override[2]!);
    } catch {
      return new Response("Jogo não encontrado.", { status: 404 });
    }
    return handleOverride(request, env.DB, env.OVERRIDE_PASSCODE, team, matchId, now);
  }
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

  if (ics) {
    const matches = await upcomingMatches(env.DB, team.slug, now, 60);
    const withChannels = await Promise.all(
      matches.map(async (match) => ({ match, effective: effectiveChannels(match, await getOverride(env.DB, match.id)) })),
    );
    log("ics.fetch", { team: team.slug });
    return new Response(renderIcs(team, url.host, withChannels, now), {
      headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=1800" },
    });
  }
  if (bare) {
    // Always send people to the URL of the current preview text (see shareSlugFor in card.ts).
    const current = await cardFor(env.DB, team, now);
    return new Response(null, { status: 302, headers: { location: `/${team.slug}/${current.shareSlug}`, "cache-control": "no-store" } });
  }
  if (og) {
    const current = await cardFor(env.DB, team, now);
    const png = await renderOg(current, renderPng);
    log("og.render", { team: team.slug, bytes: png.length });
    return new Response(png, { headers: { "content-type": "image/png", "cache-control": "public, max-age=300" } });
  }
  if (card) {
    // Any slug, current or old, shows the current card; og:url names the current share URL.
    const current = await cardFor(env.DB, team, now);
    log("page.view", { team: team.slug, slug: card[2], current: card[2] === current.shareSlug });
    return renderTeamPage(current, url.origin);
  }
  return renderNotFound();
}

export default {
  fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    return handle(request, env, new Date());
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runScrape(env.DB, new Date(), fetchSportune);
  },
} satisfies ExportedHandler<Env>;
