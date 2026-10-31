import type { Env } from "./env";
import { runScrape } from "./scraper/run";
import { fetchSportune } from "./scraper/sportune";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runScrape(env.DB, new Date(), fetchSportune);
  },
} satisfies ExportedHandler<Env>;
