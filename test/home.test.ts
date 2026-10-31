import { describe, expect, it } from "vitest";
import { get, scrapeFixtures } from "./helpers";

describe("home and 404", () => {
  it("lists every team with its next match", async () => {
    await scrapeFixtures();
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    const html = await res.text();
    for (const href of ['href="/flamengo"', 'href="/vasco"', 'href="/sao-paulo"']) expect(html).toContain(href);
    expect(html).toContain("Flamengo x Grêmio · qua 04/11 19:30");
    expect(html).toContain("Palmeiras x Vasco da Gama · dom 01/11 16:00");
  });

  it("404s an unknown team with links to the valid ones", async () => {
    const res = await get("/botafogo");
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('href="/flamengo"');
  });

  it("404s unknown paths under a team", async () => {
    expect((await get("/flamengo/whatever")).status).toBe(404);
    expect((await get("/botafogo.ics")).status).toBe(404);
  });
});
