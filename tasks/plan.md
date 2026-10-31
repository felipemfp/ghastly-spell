# Implementation Plan: Onde Passa

Spec: [SPEC.md](../SPEC.md). Tasks: [todo.md](todo.md).

## Overview

One Cloudflare Worker. A cron scrapes three Sportune team pages into D1. The fetch handler serves a card page with OG meta, an OG PNG, an .ics feed, and a passcode-protected channel override. Built in vertical slices so a real link can be shared in WhatsApp after Task 6, before the remaining features exist.

## Dependency Graph

```
scaffold (wrangler, vitest, fixtures)
   │
   ├── time.ts ──────────────┐
   │                         ▼
   └── sportune parser ──► normalize ──► D1 schema + store ──► cron handler
                                              │
                                              ├── nextMatch + effectiveChannels
                                              │        │
                                              │        ├── GET /:team (OG meta) ──► GET /:team/og.png ──► deploy + WhatsApp test
                                              │        ├── GET /:team.ics
                                              │        └── GET /
                                              └── overrides table ──► POST /:team/:matchId/channel
```

## Architecture Decisions

- **One Worker, folders as modules.** Scraper, store and web share one D1 schema and ship together. Splitting them into services would add a contract with no second consumer.
- **Parser is the riskiest piece and comes first** (Tasks 2-3). It is the only part that depends on someone else's HTML. Real fixtures captured on day 1 pin it.
- **Deploy early (Task 7).** The WhatsApp preview refresh is the idea's riskiest product assumption. Test it on a real deploy before building .ics and overrides, since the answer can change the URL design.
- **Pure functions at the core.** `parse`, `normalize`, `nextMatch`, `effectiveChannels` and all formatting take plain data and `now`, so the gate tests need no clock mocking and no network.
- **The store is the only module that touches D1.** Web handlers call store functions, which keeps SQL in one place.

## Task List

### Phase 1: Data in (fail fast on the scraper)
- [ ] Task 1: Scaffold the Worker, test setup and fixtures
- [ ] Task 2: `time.ts`: BRT parsing, year inference, formatting
- [ ] Task 3: Sportune parser: HTML → `RawListing[]`
- [ ] Task 4: Normalize, D1 schema and the scheduled scrape

### Checkpoint A: real data in local D1
- [ ] `npm test` and `npm run typecheck` pass
- [ ] `npm run scrape:local` stores the upcoming matches for all 3 teams, checked with `wrangler d1 execute --local`
- [ ] Felipe reviews before Phase 2

### Phase 2: The preview (the product)
- [ ] Task 5: `GET /:team` card page with OG meta
- [ ] Task 6: `GET /:team/og.png`
- [ ] Task 7: First deploy to workers.dev and the WhatsApp refresh test

### Checkpoint B: shareable link
- [ ] A real WhatsApp share of `/flamengo` shows the next match and channel
- [ ] Refresh test result is written into SPEC.md
- [ ] Felipe reviews before Phase 3

### Phase 3: Around the preview
- [ ] Task 8: `GET /:team.ics`
- [ ] Task 9: Channel override (form, POST, card label)
- [ ] Task 10: Home page, 404 and README

### Checkpoint C: complete
- [ ] All 7 SPEC success criteria checked, with evidence
- [ ] Deployed, cron runs on schedule, `wrangler tail` shows `scrape.done`

## Parallelization

Mostly sequential: it's a weekend project in one Worker. After Task 5, Tasks 6, 8 and 10 only read through store functions and could run in parallel. Not worth the coordination at this size.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sportune changes its HTML | High | Fixture tests pin today's format. An empty scrape writes nothing and logs `scrape.empty`. Crowd override covers gaps. |
| WhatsApp caches previews per URL | High | Tested in Task 7. Fallback: match-specific canonical URL with `/:team` redirecting to it. |
| `workers-og` font/wasm bundle too big for the free 3 MB Worker limit | Med | Checked in Task 6 with `wrangler deploy --dry-run`. Fallback: an SVG-only card or a static per-channel image. |
| Year inference wrong around New Year | Med | Explicit rollover test cases in Task 2. |
| Sportune blocks the Worker's requests | Med | 3 requests per run every few hours, project User-Agent. If blocked, futebolnatv is the documented backup. |

## Open Questions

None blocking. Moving `felipemfp.dev` DNS to Cloudflare is optional and independent of this plan.
