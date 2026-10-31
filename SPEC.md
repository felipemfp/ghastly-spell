# Spec: Onde Passa

Source idea: [docs/ideas/onde-passa.md](docs/ideas/onde-passa.md)

## Objective

A per-team URL (`/flamengo`) whose link preview in WhatsApp answers "when is the next match and where do I watch it?" without anyone opening it.

**User:** Felipe and his friends, sharing links in group chats. About 5 Brazilian teams.

**User stories**
- As a fan, I paste `/flamengo` in a group and the preview shows opponent, competition, day/time in Brasília time, and the channel(s).
- As a fan, I subscribe to `/flamengo.ics` and my calendar shows each match with the channel in the title.
- As a friend, when the channel is missing or wrong, I fix it on the page with a passcode and everyone sees "confirmed by N friends".
- As the maintainer, when the scraper breaks, I see it in the logs the same day and the site keeps serving the last good data.

**Measurable outcome:** in the first month, team URLs get hits on at least 10 distinct days, and OG image fetches show up after at least 4 separate shares (each preview render triggers a fetch). The source is the structured logs (see Observability).

## Tech Stack

> Versions are picked at scaffold time and pinned in `package.json`. Unverified until `npm install` succeeds.

- Runtime: Cloudflare Workers (free tier: 100k requests/day, Cron Triggers)
- Storage: Cloudflare D1 (SQLite)
- Language: TypeScript, strict mode
- HTTP: plain `fetch` handler with a ~20-line router (no framework)
- OG image: `workers-og` (Satori + resvg) for a 1200x630 PNG
- HTML parsing in the scraper: `HTMLRewriter` (built into Workers) or `linkedom` if the selectors need it
- Tests: Vitest + `@cloudflare/vitest-pool-workers`
- Tooling: `wrangler`

## Commands

```bash
npm install
npm run dev          # wrangler dev, local D1
npm test             # vitest run
npm run typecheck    # tsc --noEmit
npm run db:migrate   # wrangler d1 migrations apply onde-passa --local
npm run scrape:local # trigger the cron handler once against local D1
npm run deploy       # wrangler deploy  (ASK FIRST)
```

## Project Structure

```
src/
  index.ts          → fetch + scheduled entrypoints, router
  teams.ts          → team allowlist: slug, display name, aliases used by the scraper
  scraper/
    adapter.ts      → interface ScraperAdapter { fetchListings(): Promise<RawListing[]> }
    <site>.ts       → the one adapter for the chosen listing site
    normalize.ts    → RawListing → Match (team matching, BRT → UTC, channel names)
  store/
    schema.sql      → see migrations/
    matches.ts      → upsert, nextMatch(team, now), markMissing
    overrides.ts    → crowd overrides
  web/
    page.ts         → GET /:team HTML (with OG meta)
    og.ts           → GET /:team/og.png
    ics.ts          → GET /:team.ics
    override.ts     → POST /:team/:matchId/channel
  time.ts           → all formatting in America/Sao_Paulo
  log.ts            → structured JSON log lines
migrations/         → D1 SQL migrations
test/
  fixtures/         → saved HTML snapshots of the listing site
  *.test.ts
docs/ideas/         → idea one-pagers
```

## Data Model

```sql
CREATE TABLE matches (
  id            TEXT PRIMARY KEY,   -- `${home}-${away}-${competition}-${dateBRT}` e.g. flamengo-palmeiras-brasileirao-2026-11-04
  home          TEXT NOT NULL,      -- team slug, or raw name if not in the allowlist
  away          TEXT NOT NULL,
  competition   TEXT NOT NULL,
  kickoff_utc   TEXT NOT NULL,      -- ISO 8601, UTC
  channels      TEXT NOT NULL,      -- JSON array, may be []
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  missing_runs  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE channel_overrides (
  match_id          TEXT NOT NULL REFERENCES matches(id),
  channels          TEXT NOT NULL,  -- JSON array
  scraped_snapshot  TEXT NOT NULL,  -- matches.channels at the time of the override
  confirmations     INTEGER NOT NULL DEFAULT 1,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (match_id)
);
```

**Rules**
- **Next match** for a team = earliest match with `kickoff_utc > now - 2h` and `missing_runs < 2`. The 2h window keeps the card on the current match while it is being played.
- **Effective channels** = the override's channels if one exists AND `matches.channels == scraped_snapshot`. Otherwise the scraped channels win, so a scraper update beats a stale crowd fix.
- **Rescheduling:** a moved match gets a new id. The old row stops being seen, and once `missing_runs >= 2` it is hidden. Rows are never deleted.
- **Empty scrape:** if a run returns 0 listings, write nothing, log `scrape.empty` at error level, and keep serving the old data.

## Routes

| Route | Response | Cache |
|---|---|---|
| `GET /` | List of allowlisted teams, each with its next match | `max-age=300` |
| `GET /:team` | HTML card + OG/Twitter meta. `og:title` = `Flamengo x Palmeiras · qua 04/11 21:30` `og:description` = `Brasileirão · Premiere, Globo` (or `Canal ainda não divulgado`) | `max-age=300` |
| `GET /:team/og.png` | 1200x630 PNG, same content as the card, target < 300 KB | `max-age=300` |
| `GET /:team.ics` | RFC 5545 feed: next 60 days, `UID` = `<match id>@<host>`, `SUMMARY` = `Flamengo x Palmeiras (Premiere)`, `DTSTART` in UTC, 2h duration | `max-age=1800` |
| `POST /:team/:matchId/channel` | Form fields `channels` and `passcode`. 303 back to `/:team` on success, 403 on a wrong passcode, 404 for an unknown match | none |
| unknown team | 404 page listing valid teams | |

No upcoming match → the card and preview say `Sem jogos marcados`.

## Code Style

```ts
// Small pure functions, named exports, no classes. All dates cross the boundary as UTC ISO strings;
// only time.ts knows about America/Sao_Paulo.
export function effectiveChannels(match: Match, override: Override | null): Channels {
  if (override && sameChannels(override.scrapedSnapshot, match.channels)) {
    return { channels: override.channels, source: "crowd", confirmations: override.confirmations };
  }
  return { channels: match.channels, source: "scraper" };
}
```

- Files and slugs in kebab-case, functions in camelCase, types in PascalCase.
- User-facing text in pt-BR. Code, logs and comments in English.
- Never format a date with the server's timezone. Use `time.ts` (`Intl.DateTimeFormat` with `timeZone: "America/Sao_Paulo"`).
- No new dependency without asking.

## Testing Strategy

Gate tests (Vitest in the Workers pool, local, no network, under 2s):

- **normalize:** saved HTML in `test/fixtures/` → expected `Match[]`, including a listing with no channel, a team alias ("Mengão"/"CR Flamengo"), and a late-night match that crosses midnight UTC.
- **time:** 21:30 BRT on 2026-11-04 → `2026-11-05T00:30:00Z`, and formatting back gives `qua 04/11 21:30`.
- **store:** next match selection (2h window, `missing_runs` hiding), the override precedence rule both ways, an empty scrape writes nothing.
- **web:** `/:team` HTML contains the expected `og:title`, `/:team.ics` parses and has stable UIDs, a wrong passcode returns 403, an unknown team returns 404.
- **og:** the PNG renders with status 200 and is under 300 KB.

Rules: write the failing test first. Every bug gets a regression test. No snapshots of whole HTML pages (change detectors). Assert on the meta tags and fields.

Manual check before calling the MVP done: share `/flamengo` in a real WhatsApp chat, change the data, share it again, and record whether the preview updated (idea assumption 1).

No LLM components, so no eval suite.

## Observability

One JSON log line per event, read with `wrangler tail`:
- `scrape.done {listings, matches_upserted, missing_channels, duration_ms}`
- `scrape.empty` / `scrape.error {message}`
- `page.view {team}`, `og.render {team, bytes}`, `ics.fetch {team}`
- `override.saved {match_id, confirmations}`

## Boundaries

- **Always:** run `npm test` and `npm run typecheck` before each commit, keep all timezone logic in `time.ts`, respect robots.txt, scrape no more than every 3h, store only "match + channels" facts from the source site.
- **Ask first:** adding a dependency, changing the schema after the first deploy, changing the cron frequency, `npm run deploy`, adding a second scraped site, adding a team.
- **Never:** commit the passcode or other secrets (it's a `wrangler secret`), delete match rows, scrape more often than every 3h, rehost the source site's text or images, skip hooks.

## Success Criteria

1. With the fixture data, `/flamengo` renders `og:title` = `Flamengo x Palmeiras · qua 04/11 21:30` and an OG image under 300 KB.
2. Kickoff times on the card, preview and .ics all agree and are correct in BRT (test in `time.test.ts`).
3. A crowd override shows on the card with "confirmado por N amigos", and is replaced by the scraper's value once the scraper changes (tests both ways).
4. A scrape that returns 0 listings changes no rows and logs `scrape.empty`.
5. `/flamengo.ics` imports into Google Calendar and shows the channel in each event title (manual check).
6. Deployed on the free tier with the cron running every 3-6h. The whole test suite runs in under 2s.
7. The WhatsApp refresh test from Testing Strategy is done, with the result written in this spec.

## Open Questions

1. **Which listing site?** It blocks the scraper adapter. Pick by coverage of all of Flamengo's competitions and how early the channel appears.
2. **Host:** OK with Cloudflare Workers + D1, or would you rather use Vercel?
3. **Passcode:** one shared passcode for the group, or a per-friend link?
4. **Teams on day 1:** which ~5 slugs go in the allowlist?
5. **Domain:** a custom short domain, or `*.workers.dev` for now? Short links read better in previews.
