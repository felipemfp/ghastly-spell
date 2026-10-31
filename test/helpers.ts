import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src/index";

export const NOW = new Date("2026-10-31T16:00:00Z"); // fixtures were captured that day

export async function get(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`https://ondepassa.test${path}`, init), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}
