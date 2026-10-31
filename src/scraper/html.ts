// Just enough HTML tree building for Sportune's tables: nested elements, text, comments dropped.
export interface El {
  tag: string;
  attrs: string;
  children: Node[];
}
export type Node = El | string;

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "source", "wbr"]);
const TOKEN = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:"[^"]*"|'[^']*'|[^'">])*)>|[^<]+|</gi;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return String.fromCodePoint(n);
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

export function parseHtml(html: string): El {
  const root: El = { tag: "#root", attrs: "", children: [] };
  const stack: El[] = [root];
  for (const m of html.matchAll(TOKEN)) {
    const [token, closeTag, openTag, attrs = ""] = m;
    const top = stack[stack.length - 1]!;
    if (token.startsWith("<!")) continue;
    if (closeTag) {
      const tag = closeTag.toLowerCase();
      const at = stack.findLastIndex((el) => el.tag === tag);
      if (at > 0) stack.length = at; // also closes any unclosed children
    } else if (openTag) {
      const el: El = { tag: openTag.toLowerCase(), attrs, children: [] };
      top.children.push(el);
      if (!VOID.has(el.tag) && !attrs.trimEnd().endsWith("/")) stack.push(el);
    } else {
      top.children.push(decode(token));
    }
  }
  return root;
}

export const elements = (el: El): El[] => el.children.filter((c): c is El => typeof c !== "string");

export function findAll(el: El, tag: string): El[] {
  const out: El[] = [];
  for (const child of elements(el)) {
    if (child.tag === tag) out.push(child);
    out.push(...findAll(child, tag));
  }
  return out;
}

export function text(node: Node): string {
  return typeof node === "string" ? node : node.children.map(text).join("");
}

export const squash = (s: string) => s.replace(/\s+/g, " ").trim();

export const hasAttr = (el: El, name: string, value: string) => el.attrs.includes(`${name}="${value}"`);
