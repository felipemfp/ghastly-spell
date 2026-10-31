import type { Card } from "../card";
import { TEAMS } from "../teams";
import { esc, htmlResponse, layout } from "./html";
import { cardHtml } from "./page";

export function renderHome(cards: Card[]): Response {
  const body = `<p class="eyebrow">Onde Passa</p>
<h1 class="matchup">Onde assistir o próximo jogo</h1>
<p class="competition">Compartilhe o link do seu time no grupo: a prévia já mostra o jogo e o canal.</p>
<div class="teams">
${cards.map((c) => `${cardHtml(c, `/${c.team.slug}`)}\n<p class="source"><a href="/${c.team.slug}">${esc(c.title)}</a></p>`).join("\n")}
</div>`;
  return htmlResponse(layout("Onde Passa", `<meta name="description" content="Onde assistir o próximo jogo do seu time.">`, body));
}

export function renderNotFound(): Response {
  const links = TEAMS.map((t) => `<li><a href="/${t.slug}">${esc(t.name)}</a></li>`).join("");
  return htmlResponse(layout("Time não encontrado · Onde Passa", "", `<p class="eyebrow">404</p><h1 class="matchup">Time não encontrado</h1><p>Times disponíveis:</p><ul>${links}</ul>`), 404, "");
}
