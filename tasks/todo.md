# Onde Passa: Tasks

Spec: [SPEC.md](../SPEC.md). Plan: [plan.md](plan.md). Every task: write the failing test first, then `npm test && npm run typecheck` before committing.

## Phase 1: Data in

## Task 1: Scaffold the Worker, test setup and fixtures

**Description:** Create the project skeleton so every later task has a working `npm test`. Capture real Sportune pages as test fixtures.

**Acceptance criteria:**
- [ ] `package.json` with the SPEC commands, pinned dependency versions, `wrangler.toml` with a D1 binding and a cron trigger (`0 */4 * * *`)
- [ ] `GET /health` returns 200 `ok`, covered by a test running in the Workers Vitest pool
- [ ] `test/fixtures/sportune/{flamengo,vasco,sao-paulo}.html` saved, plus a `README.md` there with the capture date and URL

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Typecheck: `npm run typecheck`
- [ ] Manual check: `npm run dev`, then `curl localhost:8787/health`

**Dependencies:** None

**Files likely touched:** `package.json`, `wrangler.toml`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `test/health.test.ts`, `test/fixtures/sportune/*`

**Estimated scope:** M

## Task 2: `time.ts`: BRT parsing, year inference, formatting

**Description:** All timezone and date logic in one module: `"04/11" + "21:30"` → UTC ISO, year inference relative to `now`, and pt-BR formatting for cards.

**Acceptance criteria:**
- [ ] `toUtc("2026-11-04", "21:30")` → `2026-11-05T00:30:00Z`
- [ ] `inferYear("05/01", now=2026-12-20)` → 2027, `inferYear("20/12", now=2027-01-05)` → 2026 (30 days back / 330 ahead window)
- [ ] `formatCard("2026-11-04T22:30:00Z")` → `qua 04/11 19:30`, independent of the runtime's timezone

**Verification:**
- [ ] Tests pass: `npm test -- time`

**Dependencies:** Task 1

**Files likely touched:** `src/time.ts`, `test/time.test.ts`

**Estimated scope:** S

## Task 3: Sportune parser: HTML → `RawListing[]`

**Description:** Parse the upcoming-matches table (table 0) of a Sportune team page. Ignore the past results table. Do no date math here; return the raw strings.

**Acceptance criteria:**
- [ ] Flamengo fixture → 5 listings; first is `{date: "04/11", time: "19:30", home: "Flamengo", away: "Grêmio", competition: "Brasileirão Série A", channels: [{name: "Premiere", status: "confirmed"}]}`
- [ ] Channel status parsed: `*` → `tentative`, "anunciado pela CBF" → `cbf`; time "a confirmar" → `time: null`
- [ ] HTML with no upcoming table → `[]`, and no throw

**Verification:**
- [ ] Tests pass: `npm test -- sportune`

**Dependencies:** Task 1

**Files likely touched:** `src/scraper/adapter.ts`, `src/scraper/sportune.ts`, `test/sportune.test.ts`

**Estimated scope:** S

## Task 4: Normalize, D1 schema and the scheduled scrape

**Description:** Turn listings into `Match` rows with stable ids, write them to D1, and wire the cron handler that runs all three teams.

**Acceptance criteria:**
- [ ] Migration creates `matches` and `channel_overrides` as in the SPEC
- [ ] Re-running a scrape with the same data changes no rows except `last_seen_at`. A match absent from 2 runs gets `missing_runs >= 2`. An empty scrape writes nothing and logs `scrape.empty`
- [ ] `scrape.done` log line with counts. `npm run scrape:local` fills local D1 with real data

**Verification:**
- [ ] Tests pass: `npm test -- store normalize`
- [ ] Manual check: `npm run scrape:local`, then `wrangler d1 execute onde-passa --local --command "select id, channels from matches"`

**Dependencies:** Tasks 2, 3

**Files likely touched:** `migrations/0001_init.sql`, `src/scraper/normalize.ts`, `src/store/matches.ts`, `src/index.ts`, `src/log.ts`, `test/store.test.ts`

**Estimated scope:** M

## Checkpoint A: real data in local D1
- [ ] All tests pass, typecheck clean
- [ ] Local D1 has the upcoming matches for flamengo, vasco, sao-paulo
- [ ] Felipe reviews before Phase 2

## Phase 2: The preview

## Task 5: `GET /:team` card page with OG meta

**Description:** `nextMatch` + `effectiveChannels` (scraper-only for now) and the HTML card with OG/Twitter meta. pt-BR copy.

**Acceptance criteria:**
- [ ] With Flamengo fixture data and `now = 2026-10-31`, `og:title` is `Flamengo x Grêmio · qua 04/11 19:30` and `og:description` is `Brasileirão Série A · Premiere`
- [ ] No channel → `Canal ainda não divulgado`. No upcoming match → `Sem jogos marcados`. Tentative channel → `Premiere (a confirmar)`
- [ ] The 2h in-progress window and `missing_runs` hiding are covered by tests. `Cache-Control: max-age=300`. Logs `page.view`

**Verification:**
- [ ] Tests pass: `npm test -- page store`
- [ ] Manual check: `npm run dev`, open `/flamengo` in a browser

**Dependencies:** Task 4

**Files likely touched:** `src/store/matches.ts`, `src/web/page.ts`, `src/index.ts`, `test/page.test.ts`

**Estimated scope:** M

## Task 6: `GET /:team/og.png`

**Description:** Render the same card as a 1200x630 PNG with `workers-og`, and point `og:image` at it.

**Acceptance criteria:**
- [ ] 200 `image/png`, under 300 KB, logs `og.render {team, bytes}`
- [ ] Bundle fits the free plan limit: `wrangler deploy --dry-run --outdir dist` reports under 3 MB compressed (if not, take the fallback from the plan's risk table and note it in SPEC)
- [ ] Accents render correctly (`São Paulo`, `Grêmio`). Checked by eye on a saved PNG

**Verification:**
- [ ] Tests pass: `npm test -- og`
- [ ] Manual check: open `localhost:8787/sao-paulo/og.png`

**Dependencies:** Task 5

**Files likely touched:** `src/web/og.ts`, `src/web/page.ts`, `src/index.ts`, `test/og.test.ts`, `package.json`

**Estimated scope:** S

## Task 7: First deploy to workers.dev and the WhatsApp refresh test

**Description:** Ask Felipe before deploying. Create the remote D1, apply the migration, deploy, run one scrape, then run the preview test from the SPEC.

**Acceptance criteria:**
- [ ] `https://onde-passa.<account>.workers.dev/flamengo` serves the card with live data
- [ ] Shared in a real WhatsApp chat, the preview shows the match and channel
- [ ] Refresh test (share, change data, share again) done, with the result written into SPEC.md. If stale, a follow-up task for match-specific URLs is added here

**Verification:**
- [ ] `wrangler tail` shows `scrape.done` after the first cron run
- [ ] Manual check: the WhatsApp screenshot is kept outside the repo

**Dependencies:** Task 6

**Files likely touched:** `wrangler.toml`, `SPEC.md`

**Estimated scope:** S

## Checkpoint B: shareable link
- [ ] A real WhatsApp preview works
- [ ] Felipe reviews before Phase 3

## Phase 3: Around the preview

## Task 8: `GET /:team.ics`

**Description:** RFC 5545 calendar feed for the next 60 days.

**Acceptance criteria:**
- [ ] Stable `UID` = `<match id>@<host>`, `SUMMARY` = `Flamengo x Grêmio (Premiere)`, `DTSTART` in UTC, 2h duration. Matches with no time are all-day events
- [ ] Output parses with a strict ICS parser in the test, and CRLF line endings plus 75-octet folding hold
- [ ] `Cache-Control: max-age=1800`, logs `ics.fetch`, card page links to it

**Verification:**
- [ ] Tests pass: `npm test -- ics`
- [ ] Manual check: subscribe in Google Calendar after the next deploy

**Dependencies:** Task 5

**Files likely touched:** `src/web/ics.ts`, `src/index.ts`, `src/web/page.ts`, `test/ics.test.ts`

**Estimated scope:** S

## Task 9: Channel override (form, POST, card label)

**Description:** The "Canal errado ou faltando?" form, the POST handler checking `OVERRIDE_PASSCODE`, and `effectiveChannels` with the snapshot rule.

**Acceptance criteria:**
- [ ] Correct passcode → 303 to `/:team`, card shows the override with `confirmado por N amigos`. The same channels submitted again increment `confirmations`
- [ ] Wrong passcode → 403. Unknown match → 404. Empty or >5 channels or >40 chars each → 400
- [ ] Once the scraper's channels differ from `scraped_snapshot`, the scraped value is shown again (test both ways). Logs `override.saved`

**Verification:**
- [ ] Tests pass: `npm test -- override store`
- [ ] Manual check: `wrangler secret put OVERRIDE_PASSCODE`, submit a fix on the deployed site

**Dependencies:** Task 5

**Files likely touched:** `src/store/overrides.ts`, `src/web/override.ts`, `src/web/page.ts`, `src/index.ts`, `test/override.test.ts`

**Estimated scope:** M

## Task 10: Home page, 404 and README

**Description:** `/` lists the 3 teams with their next match. Unknown team → 404 listing valid teams. README covers setup, commands, deploy and how to add a team.

**Acceptance criteria:**
- [ ] `/` shows all 3 teams. `/botafogo` → 404 with links to valid teams
- [ ] README commands verified by running each one from a fresh clone

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Manual check: follow the README from a clean checkout

**Dependencies:** Task 5

**Files likely touched:** `src/web/home.ts`, `src/index.ts`, `test/home.test.ts`, `README.md`

**Estimated scope:** S

## Checkpoint C: complete
- [ ] All 7 SPEC success criteria checked, with evidence
- [ ] Deployed with the latest code, cron runs on schedule
- [ ] Felipe reviews
