# Onde Passa (working name)

## Problem Statement
How might we make "where can I watch my team's next match?" answerable from a WhatsApp link preview, without anyone opening a browser?

## Recommended Direction
One URL per team (`/flamengo`) whose Open Graph title and image show the next match, its kickoff time in BRT, and the broadcaster(s). The link preview in the group chat IS the answer, and the page is a single big card with the same content plus an "add to calendar" (.ics) subscription.

Broadcast data comes from scraping one "onde assistir" listing site every few hours, with fixtures and channels normalized into a tiny store. Friends can correct or fill in a channel with a one-field form. A crowd fix wins until the scraper's value changes, and the card shows its source ("via GE" / "confirmed by 2 friends").

Scope is a short allowlist of teams (the ones your group follows), not every club. Free tier hosting only, and no accounts.

## Key Assumptions to Validate
- [ ] WhatsApp shows a fresh preview after the data changes. Test: share, mutate, reshare on day 1. Fallback: match-specific canonical URLs (`/flamengo/2026-11-04`) with `/flamengo` redirecting to the next one.
- [ ] The listing site publishes the channel at least 2 days before kickoff. Test: log the first-seen time for 5 Flamengo matches.
- [ ] One site covers all of the team's competitions (Brasileirão, Copa do Brasil, Libertadores, state league). Test: compare against the last 30 days.
- [ ] Friends actually tap "fix channel" when it's wrong. Test: count corrections in the first month (more than 0 means it's alive).
- [ ] Success metric: group members open or share the link without being prompted. Test: count distinct-day hits per team URL and OG image fetches (each preview render is a fetch).

## MVP Scope
In:
- Scraper for one listing site, a cron every 3-6h, normalized into `{team, opponent, competition, kickoff_utc, channels[], source, seen_at}`
- `/:team` page + dynamic OG image (rendered in America/Sao_Paulo, never server time)
- `/:team.ics` calendar feed with channels in the event title
- "Wrong/missing channel?" form, with crowd overrides stored separately from scraped data
- Allowlist of ~5 teams
- A log line per scrape (matches found, channels missing) and per OG render, as the trace

Out: everything below.

## Not Doing (and Why)
- All clubs / all leagues: the data problem grows faster than the value, so start with your group's teams.
- Accounts, favorites, login: the URL is the favorite.
- Push notifications / bots: the calendar feed covers reminders for free.
- Multiple scraped sources and reconciliation: that's the weekend-killer, and the crowd override covers the gaps.
- "Which subscriptions do I have" filtering: good idea for v2, not needed to prove the core.
- Monetization / affiliate links: success is the group chat using it, not revenue.
- Live scores: a different product, and plenty of apps already do it.

## Risks
- Scraper breaks when the listing site changes its HTML mid-season. Mitigation: crowd override, plus a log alert when a scrape finds 0 matches.
- Scraping terms: respect robots.txt/ToS, scrape at most every few hours, store only the fact "match X on channel Y".

## Open Questions
- Which listing site? Pick the one that covers all of Flamengo's competitions with the earliest channel data (results of the coverage and lead-time assumptions).
- Stack/host: does the free tier offer edge OG image rendering (e.g., Vercel/Cloudflare) and a cron? Decide before building.
- Anti-vandalism for the crowd form: is "friends only, obscure URL" enough, or does it need a shared passcode?
