import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { expect, it } from "vitest";
import worker from "../src/index";

it("GET /health returns ok through the real fetch entrypoint", async () => {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request("https://ondepassa.test/health"), env, ctx);
  await waitOnExecutionContext(ctx);
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("ok");
});
