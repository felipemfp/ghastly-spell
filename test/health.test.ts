import { expect, it } from "vitest";
import { get } from "./helpers";

it("GET /health returns ok", async () => {
  const res = await get("/health");
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("ok");
});
