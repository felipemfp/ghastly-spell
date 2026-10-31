const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

export function htmlResponse(body: string, status = 200, cache = "public, max-age=300"): Response {
  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
  if (cache) headers["cache-control"] = cache;
  return new Response(body, { status, headers });
}

export function layout(title: string, head: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${head}
<style>
:root { --bg: #f6f3ea; --fg: #14140f; --muted: #5d5b52; --card: #fff; --accent: #c8102e; --line: #14140f22; }
@media (prefers-color-scheme: dark) { :root { --bg: #121210; --fg: #f1eee4; --muted: #a9a698; --card: #1c1c19; --line: #f1eee422; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 34rem; margin: 0 auto; padding: 2rem 1rem 3rem; }
a { color: inherit; }
.eyebrow { font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 .5rem; }
.card { background: var(--card); border: 2px solid var(--fg); padding: 1.25rem; }
.card + .card { margin-top: 1rem; }
.matchup { font-size: 1.75rem; line-height: 1.15; font-weight: 800; margin: 0; }
.when { font-size: 1.25rem; font-weight: 700; margin: .35rem 0 0; }
.competition { color: var(--muted); margin: .25rem 0 1rem; }
.channels { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0; padding: 0; list-style: none; }
.channels li { border: 2px solid var(--fg); padding: .25rem .6rem; font-weight: 700; }
.channels li.tentative { border-style: dashed; font-weight: 500; }
.source { color: var(--muted); font-size: .85rem; margin: 1rem 0 0; }
.actions { margin-top: 1.5rem; display: grid; gap: 1rem; }
details { border-top: 1px solid var(--line); padding-top: 1rem; }
summary { cursor: pointer; }
form { display: grid; gap: .5rem; margin-top: .75rem; }
input, button { font: inherit; padding: .5rem .6rem; border: 2px solid var(--fg); background: var(--card); color: var(--fg); }
button { background: var(--fg); color: var(--bg); font-weight: 700; cursor: pointer; }
.teams a { display: block; text-decoration: none; }
</style>
</head>
<body><main>
${body}
</main></body>
</html>`;
}
