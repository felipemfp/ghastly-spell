import type { Card } from "../card";
import { esc, htmlResponse, layout } from "./html";

export function renderTeamPage(card: Card, origin: string): Response {
  const slug = card.team.slug;
  const image = `${origin}/${slug}/og.png?v=${card.version}`;
  const head = [
    ["og:type", "website"], ["og:site_name", "Onde Passa"], ["og:title", card.title], ["og:description", card.description],
    ["og:url", `${origin}/${slug}`], ["og:image", image], ["og:image:width", "1200"], ["og:image:height", "630"],
  ].map(([p, c]) => `<meta property="${p}" content="${esc(c!)}">`)
    .concat([
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="description" content="${esc(card.description)}">`,
    ]).join("\n");
  return htmlResponse(layout(card.title, head, `<p class="eyebrow">Próximo jogo do ${esc(card.team.name)}</p>\n${cardHtml(card)}\n${actions(card)}`));
}

export function cardHtml(card: Card, link?: string): string {
  if (!card.match) {
    const name = link ? `<a href="${link}">${esc(card.team.name)}</a>` : esc(card.team.name);
    return `<section class="card"><p class="matchup">${name}</p><p class="competition">Sem jogos marcados</p></section>`;
  }
  const matchup = link ? `<a href="${link}">${esc(card.matchup)}</a>` : esc(card.matchup);
  return `<section class="card">
<p class="matchup">${matchup}</p>
<p class="when">${esc(card.when)}</p>
<p class="competition">${esc(card.competition)}</p>
<p class="channels-text">${esc(card.channelsText)}</p>
<p class="source">${card.credit ? esc(card.credit) : "via Sportune"}</p>
</section>`;
}

function actions(card: Card): string {
  const slug = card.team.slug;
  const calendar = `<a href="/${slug}.ics">Adicionar jogos do ${esc(card.team.name)} ao calendário</a>`;
  if (!card.match) return `<div class="actions">${calendar}</div>`;
  return `<div class="actions">
${calendar}
<details>
<summary>Canal errado ou faltando?</summary>
<form method="post" action="/${slug}/${encodeURIComponent(card.match.id)}/channel">
<label>Canais (separados por vírgula) <input name="channels" required maxlength="220" placeholder="Premiere, Globo"></label>
<label>Senha do grupo <input name="passcode" type="password" required></label>
<button type="submit">Corrigir</button>
</form>
</details>
</div>`;
}
