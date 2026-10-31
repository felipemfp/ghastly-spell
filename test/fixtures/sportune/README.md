# Sportune fixtures

Captured 2026-10-31 ~13:12 BRT from `https://sportune.com.br/onde-assistir/<slug>` for `flamengo`, `vasco`, `sao-paulo`.

Only the two `<table>` elements are kept (upcoming matches, then past results), byte for byte as served. The rest of the page is dropped so the repo holds the match facts the parser reads and nothing else.

Refresh: re-download the page, keep the tables, then update the expected values in `test/sportune.test.ts`. A failing parser test after a refresh means Sportune changed its markup.
