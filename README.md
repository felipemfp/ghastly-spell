# Onde Passa

Where to watch your team's next match, answered by the link preview. Share `/flamengo` in a WhatsApp group and the preview shows the opponent, the kickoff time in Brasília, and the channel.

- Idea: [docs/ideas/onde-passa.md](docs/ideas/onde-passa.md)
- Spec: [SPEC.md](SPEC.md)
- Plan and tasks: [tasks/plan.md](tasks/plan.md), [tasks/todo.md](tasks/todo.md)

## How it works

A Cloudflare Worker. Every 4 hours a cron reads the Sportune page of each team in [src/teams.ts](src/teams.ts) (`sportune.com.br/onde-assistir/<slug>`), and stores the upcoming matches in D1. The Worker serves:

| Route | What |
|---|---|
| `/` | Every team's next match |
| `/:team` | Card page with Open Graph tags (the preview) |
| `/:team/og.png` | 1200x630 preview image |
| `/:team.ics` | Calendar feed, next 60 days, channel in the event title |
| `POST /:team/:matchId/channel` | Friends fix a missing or wrong channel (shared passcode) |

A friend's fix shows until Sportune's value for that match changes. Then Sportune wins again.

## Setup

Node 22. Use npm 11 (`npx npm@11`): npm 10.9 crashes while resolving the test dependencies.

```bash
npx npm@11 install
```

```bash
npm run db:migrate
```

```bash
echo 'OVERRIDE_PASSCODE=pick-one' > .dev.vars
```

## Develop

```bash
npm run dev
```

In another terminal, run one scrape against the real site, then open http://localhost:8787/flamengo:

```bash
npm run scrape:local
```

## Check

```bash
npm test
```

```bash
npm run typecheck
```

With `npm run dev` running, render the real preview images (fetches fonts from Google Fonts) and check each is a PNG under 300 KB:

```bash
npm run check:og
```

Bundle size against the free plan's 3 MB limit:

```bash
npm run check:bundle
```

## Deploy (first time)

```bash
npx wrangler d1 create onde-passa
```

Put the printed `database_id` in `wrangler.toml`, then:

```bash
npx wrangler d1 migrations apply onde-passa --remote
```

```bash
npx wrangler secret put OVERRIDE_PASSCODE
```

```bash
npm run deploy
```

Watch the logs (`scrape.done`, `scrape.empty`, `page.view`, `og.render`, `ics.fetch`, `override.saved`):

```bash
npx wrangler tail
```

## Add a team

Add it to `TEAMS` in [src/teams.ts](src/teams.ts). The slug must be the one Sportune uses in its URL, and `aliases` must list every name Sportune prints for the team. Check `https://sportune.com.br/onde-assistir/<slug>` loads first.

## When Sportune changes its page

The scrape logs `scrape.empty` and keeps serving the last good data. Re-capture the fixtures (see [test/fixtures/sportune/README.md](test/fixtures/sportune/README.md)), fix [src/scraper/sportune.ts](src/scraper/sportune.ts) until `npm test` passes.
