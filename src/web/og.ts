import { ImageResponse, loadGoogleFont } from "workers-og";
import type { Card } from "../card";
import { esc } from "./html";

export type RenderPng = (html: string, text: string) => Promise<Uint8Array>;

// Satori layout: every element with more than one child needs display:flex.
export function ogHtml(card: Card): string {
  const line = (size: number, weight: number, color: string, content: string) =>
    `<div style="display:flex;font-size:${size}px;font-weight:${weight};color:${color};line-height:1.15">${esc(content)}</div>`;
  const body = card.match
    ? [
        line(64, 800, "#14140f", card.matchup),
        line(52, 800, "#c8102e", card.when),
        line(34, 400, "#5d5b52", card.competition),
        `<div style="display:flex;margin-top:28px;padding:14px 22px;border:4px solid #14140f;font-size:44px;font-weight:800">${esc(card.channelsText)}</div>`,
        card.credit ? line(28, 400, "#5d5b52", card.credit) : "",
      ]
    : [line(64, 800, "#14140f", card.team.name), line(44, 400, "#5d5b52", "Sem jogos marcados")];
  return `<div style="display:flex;flex-direction:column;justify-content:center;gap:12px;width:1200px;height:630px;padding:64px 72px;background:#f6f3ea;font-family:Inter">
${line(28, 400, "#5d5b52", "ONDE PASSA")}
${body.join("\n")}
</div>`;
}

export const renderWithWorkersOg: RenderPng = async (html, text) => {
  // Google Fonts subset to the glyphs on the card; workers-og caches the font CSS in caches.default.
  const [regular, bold] = await Promise.all([
    loadGoogleFont({ family: "Inter", weight: 400, text }),
    loadGoogleFont({ family: "Inter", weight: 800, text }),
  ]);
  const res = new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Inter", data: regular, weight: 400, style: "normal" },
      { name: "Inter", data: bold, weight: 800, style: "normal" },
    ],
  });
  return new Uint8Array(await res.arrayBuffer());
};

export async function renderOg(card: Card, render: RenderPng): Promise<Uint8Array> {
  const text = ["ONDE PASSA", card.matchup, card.when, card.competition, card.channelsText, card.credit, "Sem jogos marcados"].join(" ");
  return render(ogHtml(card), text);
}
