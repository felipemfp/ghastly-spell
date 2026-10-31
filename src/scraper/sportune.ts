import type { Channel } from "../model";
import type { FetchPage, RawListing } from "./adapter";
import { type El, elements, findAll, hasAttr, parseHtml, squash, text } from "./html";

const USER_AGENT = "onde-passa/1.0 (+https://github.com/felipemfp/ghastly-spell)";

export const fetchSportune: FetchPage = async (teamSlug) => {
  const res = await fetch(`https://sportune.com.br/onde-assistir/${teamSlug}`, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`sportune ${teamSlug}: HTTP ${res.status}`);
  return res.text();
};

// The upcoming table is the one whose last header is "Onde assistir"; past results say "Onde passou".
export function parseSportune(html: string): RawListing[] {
  const table = findAll(parseHtml(html), "table").find((t) =>
    findAll(t, "th").some((th) => squash(text(th)) === "Onde assistir"),
  );
  if (!table) return [];
  return findAll(table, "tr").flatMap((tr) => {
    const row = parseRow(findAll(tr, "td"));
    return row ? [row] : [];
  });
}

function parseRow(cells: El[]): RawListing | null {
  const [dateCell, timeCell, gameCell, competitionCell, channelCell] = cells;
  if (!dateCell || !timeCell || !gameCell || !competitionCell || !channelCell) return null;
  const date = squash(text(dateCell)).match(/\d{2}\/\d{2}/)?.[0];
  const [home, away] = squash(text(gameCell)).split("×").map(squash);
  if (!date || !home || !away) return null;
  return {
    date,
    time: squash(text(timeCell)).match(/^\d{2}:\d{2}$/)?.[0] ?? null,
    home,
    away,
    competition: squash(text(competitionCell)),
    channels: parseChannels(channelCell),
  };
}

// Each channel is <span><span>NAME[*][<sup>CBF</sup>...]</span><span>Grátis|Assinatura</span>[<a>Assistir</a>]</span>.
function parseChannels(cell: El): Channel[] {
  return elements(cell)
    .filter((el) => el.tag === "span" && !hasAttr(el, "aria-hidden", "true"))
    .flatMap((wrapper) => {
      const nameEl = elements(wrapper)[0];
      if (!nameEl) return [];
      const ownText = squash(nameEl.children.filter((c) => typeof c === "string").join(""));
      const name = ownText.replace(/\*$/, "").trim();
      if (!name) return [];
      const isCbf = elements(nameEl).some((el) => el.tag === "sup" && squash(text(el)) === "CBF");
      const status = isCbf ? "cbf" : ownText.endsWith("*") ? "tentative" : "confirmed";
      return [{ name, status } satisfies Channel];
    });
}
